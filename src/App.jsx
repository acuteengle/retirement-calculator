import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const DEFAULTS = {
  currentAge: 32,
  currentInvested: 1000000,
  annualRetirementSpendToday: 100000,
  retirementYear: new Date().getFullYear() + 25,
  annualGrowthRate: 7,
  annualInflationRate: 3,
  deathAge: 90,
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

const formatNumberInput = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const parsed = Number(String(value).replaceAll(',', ''))
  if (Number.isNaN(parsed)) return ''
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(parsed)
}

const parseNumberInput = (value) => value.replace(/[^\d]/g, '')

const clampNumber = (value, fallback) => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

function App() {
  const [currentAge, setCurrentAge] = useState(DEFAULTS.currentAge)
  const [currentInvested, setCurrentInvested] = useState(DEFAULTS.currentInvested)
  const [annualRetirementSpendToday, setAnnualRetirementSpendToday] = useState(
    DEFAULTS.annualRetirementSpendToday,
  )
  const [retirementYear, setRetirementYear] = useState(DEFAULTS.retirementYear)
  const [annualGrowthRate, setAnnualGrowthRate] = useState(DEFAULTS.annualGrowthRate)
  const [annualInflationRate, setAnnualInflationRate] = useState(DEFAULTS.annualInflationRate)
  const [deathAge, setDeathAge] = useState(DEFAULTS.deathAge)
  const [monthlyContributionOverride, setMonthlyContributionOverride] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const results = useMemo(() => {
    const todayYear = new Date().getFullYear()
    const cleanCurrentAge = Math.max(0, clampNumber(currentAge, DEFAULTS.currentAge))
    const cleanCurrentInvested = Math.max(
      0,
      clampNumber(currentInvested, DEFAULTS.currentInvested),
    )
    const cleanAnnualSpend = Math.max(
      0,
      clampNumber(annualRetirementSpendToday, DEFAULTS.annualRetirementSpendToday),
    )
    const cleanRetirementYear = Math.max(
      todayYear,
      Math.round(clampNumber(retirementYear, DEFAULTS.retirementYear)),
    )
    const cleanGrowthRate = clampNumber(annualGrowthRate, DEFAULTS.annualGrowthRate) / 100
    const cleanInflationRate =
      clampNumber(annualInflationRate, DEFAULTS.annualInflationRate) / 100
    const cleanDeathAge = Math.max(cleanCurrentAge, clampNumber(deathAge, DEFAULTS.deathAge))
    const cleanMonthlyOverride =
      monthlyContributionOverride === '' ? null : Number(monthlyContributionOverride)

    const yearsToRetirement = Math.max(0, cleanRetirementYear - todayYear)
    const retirementAge = cleanCurrentAge + yearsToRetirement
    const deathYear = todayYear + Math.max(0, Math.round(cleanDeathAge - cleanCurrentAge))

    const retirementNumberToday = cleanAnnualSpend / 0.04
    const retirementNumberFuture =
      retirementNumberToday * (1 + cleanInflationRate) ** yearsToRetirement
    const retirementSpendFuture =
      cleanAnnualSpend * (1 + cleanInflationRate) ** yearsToRetirement

    const simulateBalanceAtRetirement = (annualContributionAmount) => {
      let balance = cleanCurrentInvested
      for (let i = 1; i <= yearsToRetirement; i += 1) {
        const year = todayYear + i
        const contributionForYear = year < cleanRetirementYear ? annualContributionAmount : 0
        balance = balance * (1 + cleanGrowthRate) + contributionForYear
      }
      return balance
    }

    let requiredAnnualContribution = 0
    if (yearsToRetirement === 0) {
      requiredAnnualContribution = retirementNumberFuture - cleanCurrentInvested
    } else {
      const balanceWithZeroContribution = simulateBalanceAtRetirement(0)
      if (balanceWithZeroContribution < retirementNumberFuture) {
        let low = 0
        let high = 1

        while (simulateBalanceAtRetirement(high) < retirementNumberFuture) {
          high *= 2
          if (high > 10000000) break
        }

        for (let i = 0; i < 60; i += 1) {
          const mid = (low + high) / 2
          if (simulateBalanceAtRetirement(mid) >= retirementNumberFuture) {
            high = mid
          } else {
            low = mid
          }
        }
        requiredAnnualContribution = high
      }
    }

    const annualContribution = Math.max(0, requiredAnnualContribution)
    const monthlyContribution = annualContribution / 12
    const plannedMonthlyContribution =
      cleanMonthlyOverride === null ? monthlyContribution : Math.max(0, cleanMonthlyOverride)
    const plannedAnnualContribution = plannedMonthlyContribution * 12

    const chartData = []
    let runningBalance = cleanCurrentInvested

    chartData.push({
      year: todayYear,
      balance: runningBalance,
      targetPath: retirementNumberToday,
      spending: 0,
      phase: 'Accumulation',
    })

    for (let i = 1; i <= yearsToRetirement; i += 1) {
      const year = todayYear + i
      const contributionForYear = year < cleanRetirementYear ? plannedAnnualContribution : 0
      runningBalance = runningBalance * (1 + cleanGrowthRate) + contributionForYear
      chartData.push({
        year,
        balance: runningBalance,
        targetPath: retirementNumberToday * (1 + cleanInflationRate) ** i,
        spending: 0,
        phase: 'Accumulation',
      })
    }

    let depletedYear = null
    for (let year = cleanRetirementYear + 1; year <= deathYear; year += 1) {
      const yearsFromToday = year - todayYear
      const annualSpendingFuture = cleanAnnualSpend * (1 + cleanInflationRate) ** yearsFromToday
      runningBalance = runningBalance * (1 + cleanGrowthRate) - annualSpendingFuture
      if (depletedYear === null && runningBalance <= 0) {
        depletedYear = year
      }

      chartData.push({
        year,
        balance: runningBalance,
        targetPath: null,
        spending: annualSpendingFuture,
        phase: 'Drawdown',
      })
    }

    const endingBalance = chartData[chartData.length - 1]?.balance ?? runningBalance

    return {
      todayYear,
      yearsToRetirement,
      retirementAge,
      deathYear,
      retirementNumberToday,
      retirementNumberFuture,
      retirementSpendFuture,
      annualContribution,
      monthlyContribution,
      plannedAnnualContribution,
      plannedMonthlyContribution,
      hasManualContribution: cleanMonthlyOverride !== null,
      endingBalance,
      depletedYear,
      chartData,
    }
  }, [
    annualGrowthRate,
    annualInflationRate,
    annualRetirementSpendToday,
    currentAge,
    currentInvested,
    deathAge,
    monthlyContributionOverride,
    retirementYear,
  ])

  return (
    <main className="app-shell">
      <header>
        <p className="kicker">Retirement Calculator</p>
        <h1>Plan your path to financial independence</h1>
        <p className="subtitle">
          Uses the 4% rule, yearly end-of-year contributions, and inflation-adjusted spending.
        </p>
      </header>

      <section className="panel">
        <div className="input-grid">
          <label>
            Current age
            <input
              type="number"
              min="0"
              value={currentAge}
              onChange={(e) => setCurrentAge(e.target.value)}
            />
          </label>
          <label>
            Retirement year
            <input
              type="number"
              min={results.todayYear}
              value={retirementYear}
              onChange={(e) => setRetirementYear(e.target.value)}
            />
          </label>
          <label>
            Amount invested today
            <div className="currency-input">
              <span aria-hidden="true">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(currentInvested)}
                onChange={(e) => setCurrentInvested(parseNumberInput(e.target.value))}
              />
            </div>
          </label>
          <label>
            Annual spending goal at retirement (today&apos;s dollars)
            <div className="currency-input">
              <span aria-hidden="true">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(annualRetirementSpendToday)}
                onChange={(e) => setAnnualRetirementSpendToday(parseNumberInput(e.target.value))}
              />
            </div>
          </label>
          <label>
            Monthly contribution (optional override)
            <div className="currency-input">
              <span aria-hidden="true">$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={formatNumberInput(Math.round(results.monthlyContribution))}
                value={formatNumberInput(monthlyContributionOverride)}
                onChange={(e) => setMonthlyContributionOverride(parseNumberInput(e.target.value))}
              />
            </div>
          </label>
        </div>

        <button
          className="link-button"
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
        </button>

        {showAdvanced && (
          <div className="input-grid advanced">
            <label>
              Annual growth rate (%)
              <input
                type="number"
                step="0.1"
                value={annualGrowthRate}
                onChange={(e) => setAnnualGrowthRate(e.target.value)}
              />
            </label>
            <label>
              Annual inflation rate (%)
              <input
                type="number"
                step="0.1"
                value={annualInflationRate}
                onChange={(e) => setAnnualInflationRate(e.target.value)}
              />
            </label>
            <label>
              Death age
              <input
                type="number"
                min={currentAge || 0}
                value={deathAge}
                onChange={(e) => setDeathAge(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="label">Retirement number (today&apos;s dollars)</p>
          <p className="value">{formatCurrency(results.retirementNumberToday)}</p>
        </article>
        <article className="stat-card">
          <p className="label">Retirement number (future dollars)</p>
          <p className="value">{formatCurrency(results.retirementNumberFuture)}</p>
        </article>
        <article className="stat-card">
          <p className="label">Required annual contribution</p>
          <p className="value">{formatCurrency(results.annualContribution)}</p>
        </article>
        <article className="stat-card">
          <p className="label">Required monthly contribution</p>
          <p className="value">{formatCurrency(results.monthlyContribution)}</p>
        </article>
        <article className="stat-card">
          <p className="label">
            {results.hasManualContribution ? 'Using monthly contribution' : 'Modeled monthly contribution'}
          </p>
          <p className="value">{formatCurrency(results.plannedMonthlyContribution)}</p>
        </article>
      </section>

      <section className="panel chart-panel">
        <div className="chart-copy">
          <h2>Portfolio trajectory: accumulation and drawdown</h2>
          <p>
            Retirement in {results.yearsToRetirement} years (age {results.retirementAge}) with
            annual spending of {formatCurrency(results.retirementSpendFuture)} in retirement-year
            dollars.
          </p>
          <p>
            Ending balance by year {results.deathYear}:{' '}
            <strong>{formatCompactCurrency(results.endingBalance)}</strong>
          </p>
          <p>
            Graph assumes annual contribution of{' '}
            <strong>{formatCurrency(results.plannedAnnualContribution)}</strong> (
            {formatCurrency(results.plannedMonthlyContribution)} monthly).
          </p>
          {results.depletedYear ? (
            <p className="warning">
              Portfolio depletes around year {results.depletedYear}. Consider retiring later,
              reducing spending, or increasing contributions.
            </p>
          ) : (
            <p className="success">Portfolio remains funded through the selected death age.</p>
          )}
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={results.chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(value) => formatCompactCurrency(value)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'balance') return [formatCurrency(value), 'Portfolio']
                  if (name === 'targetPath')
                    return value ? [formatCurrency(value), 'Target by year'] : ['-', 'Target by year']
                  return [formatCurrency(value), 'Spending']
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="balance"
                stroke="#0f766e"
                dot={false}
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="targetPath"
                name="targetPath"
                stroke="#2563eb"
                dot={false}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="spending"
                name="spending"
                stroke="#7c3aed"
                dot={false}
                strokeDasharray="3 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="footnote">
        4% rule quick note: a common planning heuristic is that you can withdraw about 4% of your
        portfolio in the first retirement year (then adjust that dollar amount for inflation each
        year). This directly determines the size of your nest egg: if you want to spend more per
        year, your target portfolio must be larger. That is why the calculator estimates your
        retirement number as annual spending divided by 0.04.
      </p>
    </main>
  )
}

export default App

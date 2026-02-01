import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { motion, useInView } from 'framer-motion'
import { Menu, X, GitBranch, MessageSquare, BarChart3, Route, Brain, ArrowRight } from 'lucide-react'
import './landing.css'

const navItems = [
  { label: 'Features', href: '#features' },
]

function Navbar() {
  const { isAuthenticated } = useAuth()
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navRef = useRef(null)

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl"
    >
      <nav
        ref={navRef}
        className="relative flex items-center justify-between px-4 py-3 rounded-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800"
      >
        {/* Logo */}
        <Link to={isAuthenticated ? '/app' : '/'} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-400 flex items-center justify-center">
            <span className="text-zinc-950 font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-white hidden sm:block">ATLAS</span>
        </Link>
        <a
          href="#features"
          className="hidden md:block ml-2 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Features
        </a>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="shimmer-btn px-4 py-1.5 text-sm font-medium bg-white text-zinc-950 hover:bg-zinc-200 rounded-full transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-zinc-400 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-zinc-800"
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <hr className="border-zinc-800 my-2" />
            <Link
              to="/login"
              className="px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="shimmer-btn px-4 py-3 text-sm font-medium text-center bg-white text-zinc-950 hover:bg-zinc-200 rounded-full transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}

// ---------------------------------------------------------------------------
// Bento Grid — Features section
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

function ImportanceScoreDots() {
  const [dots, setDots] = useState([true, true, true, false, true])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => prev.map(() => Math.random() > 0.2))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2">
      {dots.map((active, i) => (
        <motion.div
          key={i}
          className={`w-2 h-2 rounded-full ${active ? 'bg-cyan-400' : 'bg-zinc-700'}`}
          animate={active ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

function WalkthroughSteps() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % 4)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const steps = ['main.py', 'routes.py', 'models.py', 'utils.py']

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <motion.kbd
          key={step}
          animate={i === active ? { scale: 0.95, y: 2, backgroundColor: 'rgb(8 145 178)' } : { scale: 1, y: 0, backgroundColor: 'rgb(39 39 42)' }}
          transition={{ duration: 0.2 }}
          className="px-2 py-1 text-xs border border-zinc-700 rounded text-zinc-300 font-mono"
        >
          {step}
        </motion.kbd>
      ))}
    </div>
  )
}

function AnimatedImportanceChart() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const points = [
    { x: 0, y: 10 },
    { x: 16, y: 15 },
    { x: 32, y: 25 },
    { x: 48, y: 20 },
    { x: 64, y: 40 },
    { x: 80, y: 35 },
    { x: 100, y: 60 },
  ]

  const pathD = points.reduce((acc, point, i) =>
    i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`
  , '')

  return (
    <svg ref={ref} viewBox="0 0 100 70" className="w-full h-24">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {isInView && (
        <>
          <path d={`${pathD} L 100 70 L 0 70 Z`} fill="url(#chartGradient)" className="opacity-50" />
          <path d={pathD} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" strokeLinecap="round" className="draw-line" />
        </>
      )}
    </svg>
  )
}

function BentoGrid() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to onboard fast
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            AI-powered analysis that turns any codebase into a guided learning experience for new developers.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Large card — AI File Analysis */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-2 group relative p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="p-2 rounded-lg bg-zinc-800 w-fit mb-4">
                  <Brain className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">AI File Analysis</h3>
                <p className="text-zinc-400 text-sm">
                  Claude analyzes every file and assigns importance scores, summaries, and key responsibilities — so you know what matters.
                </p>
              </div>
              <ImportanceScoreDots />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Entry Point', score: '10' },
                { label: 'Core Logic', score: '8' },
                { label: 'Utilities', score: '5' },
                { label: 'Config', score: '7' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">{item.score}</div>
                  <div className="text-xs text-zinc-500">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Guided Walkthrough */}
          <motion.div
            variants={itemVariants}
            className="group relative p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300"
          >
            <div className="p-2 rounded-lg bg-zinc-800 w-fit mb-4">
              <Route className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Guided Walkthrough</h3>
            <p className="text-zinc-400 text-sm mb-6">Step through the codebase in the optimal reading order, from entry point to utilities.</p>
            <WalkthroughSteps />
          </motion.div>

          {/* Importance Scoring */}
          <motion.div
            variants={itemVariants}
            className="group relative p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300"
          >
            <div className="p-2 rounded-lg bg-zinc-800 w-fit mb-4">
              <BarChart3 className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Importance Scoring</h3>
            <p className="text-zinc-400 text-sm mb-4">See which files matter most — the graph filters to infrastructure, not noise.</p>
            <AnimatedImportanceChart />
          </motion.div>

          {/* Semantic Graph */}
          <motion.div
            variants={itemVariants}
            className="group relative p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300"
          >
            <div className="p-2 rounded-lg bg-zinc-800 w-fit mb-4">
              <GitBranch className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Dependency Graph</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Interactive visualization of how files connect — color-coded by type, filtered by importance.
            </p>
            <div className="flex items-center gap-2 text-cyan-400 text-sm">
              <span className="font-mono">Hover</span>
              <span className="text-zinc-500">for AI summaries</span>
            </div>
          </motion.div>

          {/* Ask Atlas — RAG Q&A */}
          <motion.div
            variants={itemVariants}
            className="group relative p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300"
          >
            <div className="p-2 rounded-lg bg-zinc-800 w-fit mb-4">
              <MessageSquare className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Ask Atlas</h3>
            <p className="text-zinc-400 text-sm mb-4">Ask natural-language questions and get grounded answers with file:line citations.</p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs bg-zinc-800 rounded text-zinc-400">RAG</span>
              <span className="px-2 py-1 text-xs bg-zinc-800 rounded text-zinc-400">Citations</span>
              <span className="px-2 py-1 text-xs bg-zinc-800 rounded text-zinc-400">Claude</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="py-24 px-4">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto text-center"
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
          Ready to onboard faster?
        </h2>
        <p className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          Connect your GitHub, pick a repo, and let Atlas guide you through the codebase. Free and open source.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="shimmer-btn inline-flex items-center px-8 py-4 text-base font-medium bg-white text-zinc-950 hover:bg-zinc-200 rounded-full transition-colors shadow-lg shadow-white/20"
          >
            Get Started Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-4 text-base font-medium border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-700 rounded-full transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

const textRevealVariants = {
  hidden: { y: '100%' },
  visible: (i) => ({
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.1,
    },
  }),
}

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 pointer-events-none" />

      {/* Subtle radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
          <span className="text-sm text-zinc-400">Now in Public Beta</span>
        </motion.div>

        {/* Headline with text mask animation */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
          <span className="block overflow-hidden">
            <motion.span className="block" variants={textRevealVariants} initial="hidden" animate="visible" custom={0}>
              Onboard faster.
            </motion.span>
          </span>
          <span className="block overflow-hidden">
            <motion.span
              className="block text-zinc-500"
              variants={textRevealVariants}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              Ship sooner.
            </motion.span>
          </span>
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Atlas uses AI to analyze repositories, score file importance, and guide new developers through the code that actually matters.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/signup"
            className="shimmer-btn inline-flex items-center bg-white text-zinc-950 hover:bg-zinc-200 rounded-full px-8 h-12 text-base font-medium shadow-lg shadow-white/10 transition-colors"
          >
            Get Started Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center rounded-full px-8 h-12 text-base font-medium border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-700 bg-transparent transition-colors"
          >
            Learn More
          </a>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

const footerLinks = {
  Product: ['Features', 'Changelog', 'Roadmap'],
  Resources: ['Documentation', 'Guides', 'Blog'],
  Company: ['About', 'GitHub', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security'],
}

function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <footer ref={ref} className="border-t border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-8"
        >
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-400 flex items-center justify-center">
                <span className="text-zinc-950 font-bold text-sm">A</span>
              </div>
              <span className="font-semibold text-white">ATLAS</span>
            </a>
            <p className="text-sm text-zinc-500 mb-4">AI-powered developer onboarding for any codebase.</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
              <span className="text-xs text-zinc-400">All Systems Operational</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} Atlas. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Twitter
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">
              GitHub
            </a>
            <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Discord
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="landing min-h-screen bg-zinc-950 text-white">
      <div className="noise-overlay" />
      <Navbar />
      <Hero />
      <BentoGrid />
      <FinalCTA />
      <Footer />
    </div>
  )
}

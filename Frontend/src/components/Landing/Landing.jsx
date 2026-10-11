import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Flame,
  ArrowUpRight,
  Volume2,
  Lock,
  ChevronRight
} from 'lucide-react';
import './Landing.css';

const SCHEDULE_BOARD = [
  {
    category: 'UPSC',
    badgeClass: 'badge-upsc',
    code: 'UP-7891',
    title: 'Civil Services 2027 · GS Paper I',
    syllabus: 'Modern History & M. Laxmikanth Polity Drills',
    activeCount: 18,
    maxCapacity: 20,
    cadence: '50/10 min',
    cycle: 'Cycle 3 of 4',
    pactHours: '8 hrs/day'
  },
  {
    category: 'GATE',
    badgeClass: 'badge-gate',
    code: 'GT-4021',
    title: 'CS / IT Rankers Sprint 2026',
    syllabus: 'Operating Systems & Algorithm Problem Sets',
    activeCount: 14,
    maxCapacity: 16,
    cadence: '50/10 min',
    cycle: 'Cycle 2 of 4',
    pactHours: '6.5 hrs/day'
  },
  {
    category: 'JEE',
    badgeClass: 'badge-jee',
    code: 'JE-9942',
    title: 'Advanced Physics & Calculus Blitz',
    syllabus: 'Rotational Dynamics & Integral Calculus Drills',
    activeCount: 16,
    maxCapacity: 18,
    cadence: '25/5 min',
    cycle: 'Cycle 4 of 6',
    pactHours: '7.5 hrs/day'
  },
  {
    category: 'NEET',
    badgeClass: 'badge-neet',
    code: 'NE-3310',
    title: 'NCERT Biology Active Recall Group',
    syllabus: 'Genetics, Plant Physiology & Human Anatomy Review',
    activeCount: 22,
    maxCapacity: 24,
    cadence: '50/10 min',
    cycle: 'Cycle 1 of 4',
    pactHours: '9 hrs/day'
  },
  {
    category: 'CAT',
    badgeClass: 'badge-cat',
    code: 'CA-5519',
    title: 'Quant 99%ile & DILR Sprints',
    syllabus: 'Arithmetic, Permutations & Sectional Mock Drills',
    activeCount: 11,
    maxCapacity: 15,
    cadence: '25/5 min',
    cycle: 'Cycle 2 of 4',
    pactHours: '5 hrs/day'
  },
  {
    category: 'GENERAL',
    badgeClass: 'badge-general',
    code: 'GN-1002',
    title: 'Silent Library · Deep Work Only',
    syllabus: 'Zero-Interruption Focus · Open Subject Study',
    activeCount: 29,
    maxCapacity: 30,
    cadence: '50/10 min',
    cycle: 'Cycle 3 of 4',
    pactHours: 'Open'
  }
];

export default function Landing() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [quickCode, setQuickCode] = useState('');
  const [activeChecklist, setActiveChecklist] = useState({
    item1: true,
    item2: true,
    item3: false,
    item4: false
  });

  const filteredRooms = activeTab === 'ALL'
    ? SCHEDULE_BOARD
    : SCHEDULE_BOARD.filter(item => item.category === activeTab);

  return (
    <div className="sp-split-layout">
      {/* =========================================================================
          LEFT DESK RAIL (Fixed Architectural Index & Command Column)
          ========================================================================= */}
      <aside className="sp-rail">
        <div className="sp-rail-header">
          <Link to="/" className="sp-rail-brand">
            <span className="sp-rail-monogram">SP</span>
            <div className="sp-rail-brand-meta">
              <span className="sp-rail-title">StudyPact</span>
              <span className="sp-rail-version">STUDY PLATFORM</span>
            </div>
          </Link>
          <div className="sp-rail-live-badge">
            <span className="live-dot-pulse"></span>
            <span>1,480 Students Studying Now</span>
          </div>
        </div>

        {/* Index Chapters Navigation */}
        <nav className="sp-rail-nav">
          <span className="sp-rail-nav-label">INDEX / SECTIONS</span>
          <a href="#manifesto" className="sp-rail-link active">
            <span className="link-num">01</span>
            <span className="link-name">The Discipline</span>
          </a>
          <a href="#live-hud" className="sp-rail-link">
            <span className="link-num">02</span>
            <span className="link-name">Active Focus HUD</span>
          </a>
          <a href="#schedule-board" className="sp-rail-link">
            <span className="link-num">03</span>
            <span className="link-name">Study Rooms</span>
          </a>
          <a href="#three-rules" className="sp-rail-link">
            <span className="link-num">04</span>
            <span className="link-name">The Three Rules</span>
          </a>
          <a href="#covenant" className="sp-rail-link">
            <span className="link-num">05</span>
            <span className="link-name">Daily Goals</span>
          </a>
        </nav>

        {/* Quick Room Access */}
        <div className="sp-rail-quickbox">
          <span className="quickbox-title">ROOM QUICK-ACCESS</span>
          <p className="quickbox-desc">Enter a room code to jump straight into a study room:</p>
          <div className="quickbox-input-row">
            <input
              type="text"
              placeholder="e.g. UP-7891"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              maxLength={7}
              className="quickbox-input"
            />
            <Link
              to={quickCode ? `/study-room/${quickCode}` : '/signin'}
              className="btn btn-primary btn-sm quickbox-btn"
            >
              Enter
            </Link>
          </div>
        </div>

        {/* Auth CTAs in Rail */}
        <div className="sp-rail-footer">
          <Link to="/signin" className="btn btn-secondary btn-sm sp-rail-auth-btn">
            Sign In to StudyPact
          </Link>
          <Link to="/signup" className="btn btn-primary btn-sm sp-rail-auth-btn">
            Create Free Account
          </Link>
          <div className="sp-rail-copyright">
            &copy; 2026 StudyPact. Built for competitive exam discipline.
          </div>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN STAGE (Fluid Editorial Monograph Canvas)
          ========================================================================= */}
      <main className="sp-stage">
        {/* Top Header Bar for Mobile / Tablet */}
        <div className="sp-stage-topbar">
          <div className="topbar-crumb">
            <span>STUDYPACT</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active">NATIONAL EXAMINATION LEDGER</span>
          </div>
          <div className="topbar-actions">
            <Link to="/signin" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Start a Pact</Link>
          </div>
        </div>

        {/* Section 01: Hero Manifesto */}
        <section id="manifesto" className="stage-section hero-manifesto-block">
          <div className="manifesto-provenance">
            <span className="provenance-chip">SYNCHRONIZED STUDY ROOMS</span>
            <span className="provenance-text">UPSC &middot; GATE &middot; JEE &middot; NEET &middot; CAT</span>
          </div>

          <h1 className="manifesto-headline">
            The loneliness of the long-distance aspirant <span className="headline-italic">ends here</span>.
          </h1>

          <p className="manifesto-lede">
            Studying alone can make staying focused difficult. StudyPact brings students together in synchronized study rooms—where you set daily goals, follow Pomodoro cycles together, and build consistent study habits with peers.
          </p>

          <div className="manifesto-cta-row">
            <Link to="/signup" className="btn btn-primary btn-lg manifesto-btn">
              <span>Start Studying Now</span>
              <ArrowRight size={16} />
            </Link>
            <a href="#schedule-board" className="btn btn-secondary btn-lg">
              <span>Browse Study Rooms</span>
              <ChevronRight size={16} />
            </a>
          </div>

          {/* Tabular National Ticker Strip */}
          <div className="national-metrics-bar">
            <div className="metric-cell">
              <span className="metric-val">12,400+</span>
              <span className="metric-cap">Enrolled Aspirants</span>
            </div>
            <div className="metric-cell">
              <span className="metric-val">98.4%</span>
              <span className="metric-cap">Daily Pacts Honored</span>
            </div>
            <div className="metric-cell">
              <span className="metric-val">152,000</span>
              <span className="metric-cap">Focus Hours Logged</span>
            </div>
            <div className="metric-cell">
              <span className="metric-val">0 min</span>
              <span className="metric-cap">Social Distraction</span>
            </div>
          </div>
        </section>

        {/* Section 02: Full-Bleed Live Chamber HUD (Interactive Product Simulation) */}
        <section id="live-hud" className="stage-section">
          <div className="section-brow">§ 02 / REAL-TIME ARCHITECTURE</div>
          <h2 className="stage-section-title">Anatomy of an active focus session</h2>
          <p className="stage-section-sub">
            This is what happens when you enter a room. No video fatigue, no unstructured chats—just synchronized intervals and mutual presence.
          </p>

          {/* Panoramic HUD Instrument Card */}
          <div className="hud-panoramic-card">
            {/* Top HUD Status Ribbon */}
            <div className="hud-ribbon">
              <div className="hud-ribbon-left">
                <span className="hud-live-tag">
                  <span className="live-pulsar"></span>
                  ROOM ACTIVE // SYNCHRONIZED POMODORO
                </span>
                <span className="hud-room-id">ROOM // UP-7891 (GS-1 MAINS ANSWER DRILL)</span>
              </div>
              <div className="hud-ribbon-right">
                <span className="hud-audio-status">
                  <Volume2 size={13} />
                  <span>White Noise &middot; Lo-Fi Stream On</span>
                </span>
                <span className="hud-lock-status">
                  <Lock size={13} />
                  <span>Door Sealed</span>
                </span>
              </div>
            </div>

            {/* 3-Column HUD Grid */}
            <div className="hud-columns-grid">
              {/* HUD Col 1: Chronometer & Interval */}
              <div className="hud-col hud-clock-col">
                <span className="hud-col-label">FOCUS CHRONOMETER</span>
                <div className="hud-clock-face">
                  <span className="hud-clock-digits">23:48</span>
                  <span className="hud-clock-meta">OF 50 MIN CYCLE</span>
                </div>
                <div className="hud-cycle-tracker">
                  <div className="cycle-bar-track">
                    <div className="cycle-bar-fill" style={{ width: '58%' }}></div>
                  </div>
                  <div className="cycle-numbers">
                    <span>CYCLE 2 OF 4</span>
                    <span>10 MIN BREAK AT 00:00</span>
                  </div>
                </div>
                <div className="hud-streak-counter">
                  <Flame size={14} className="streak-flame-icon" />
                  <span>Group Study Streak: <strong>18 Consecutive Days</strong></span>
                </div>
              </div>

              {/* HUD Col 2: Today's Non-Negotiable Syllabus Agenda */}
              <div className="hud-col hud-agenda-col">
                <span className="hud-col-label">TODAY'S STUDY GOALS</span>
                <div className="hud-agenda-items">
                  <div
                    className={`agenda-item ${activeChecklist.item1 ? 'done' : ''}`}
                    onClick={() => setActiveChecklist(c => ({ ...c, item1: !c.item1 }))}
                  >
                    <CheckCircle2 size={16} className="agenda-icon" />
                    <span>Laxmikanth Ch. 18: President & Ordinance Powers</span>
                  </div>
                  <div
                    className={`agenda-item ${activeChecklist.item2 ? 'done' : ''}`}
                    onClick={() => setActiveChecklist(c => ({ ...c, item2: !c.item2 }))}
                  >
                    <CheckCircle2 size={16} className="agenda-icon" />
                    <span>Answer Writing: 2024 GS-1 Modern History (3 Qs)</span>
                  </div>
                  <div
                    className={`agenda-item ${activeChecklist.item3 ? 'done' : ''}`}
                    onClick={() => setActiveChecklist(c => ({ ...c, item3: !c.item3 }))}
                  >
                    <Circle size={16} className="agenda-icon" />
                    <span>Current Affairs: The Hindu Editorial Syntheses</span>
                  </div>
                  <div
                    className={`agenda-item ${activeChecklist.item4 ? 'done' : ''}`}
                    onClick={() => setActiveChecklist(c => ({ ...c, item4: !c.item4 }))}
                  >
                    <Circle size={16} className="agenda-icon" />
                    <span>Previous Year Prelims MCQ Drill (50 Qs)</span>
                  </div>
                </div>
                <span className="hud-note">* Check off your study goals as you complete each session.</span>
              </div>

              {/* HUD Col 3: Peer Accountability Matrix */}
              <div className="hud-col hud-peers-col">
                <span className="hud-col-label">ACTIVE STUDENTS ONLINE (18)</span>
                <div className="hud-peer-rows">
                  <div className="peer-row">
                    <span className="peer-av av-1">AR</span>
                    <div className="peer-info">
                      <span className="peer-name">Ananya Roy</span>
                      <span className="peer-target">Ethics GS-4 Case Studies 5-8</span>
                    </div>
                    <span className="peer-status">LOCKED</span>
                  </div>

                  <div className="peer-row">
                    <span className="peer-av av-2">VS</span>
                    <div className="peer-info">
                      <span className="peer-name">Vikram Sharma</span>
                      <span className="peer-target">Polity Emergency Provisions Notes</span>
                    </div>
                    <span className="peer-status">LOCKED</span>
                  </div>

                  <div className="peer-row">
                    <span className="peer-av av-3">PM</span>
                    <div className="peer-info">
                      <span className="peer-name">Priyam Mishra</span>
                      <span className="peer-target">Economic Survey 2025 Synthesis</span>
                    </div>
                    <span className="peer-status">LOCKED</span>
                  </div>

                  <div className="peer-row">
                    <span className="peer-av av-4">KN</span>
                    <div className="peer-info">
                      <span className="peer-name">Kavita N.</span>
                      <span className="peer-target">Geography NCERT Class 11 Revision</span>
                    </div>
                    <span className="peer-status">LOCKED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 03: The Schedule Board (Ledger Departure Table) */}
        <section id="schedule-board" className="stage-section">
          <div className="section-brow">§ 03 / LIVE DIRECTORY</div>
          <div className="directory-header-row">
            <div>
              <h2 className="stage-section-title">Active Study Rooms</h2>
              <p className="stage-section-sub">
                Real-time active study rooms. Select an examination track to find peers studying your subject.
              </p>
            </div>
            <Link to="/signup" className="btn btn-primary btn-sm">
              Create Study Room
            </Link>
          </div>

          {/* Exam Filter Tab Pills */}
          <div className="board-filter-tabs">
            {['ALL', 'UPSC', 'GATE', 'JEE', 'NEET', 'CAT', 'GENERAL'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`board-filter-pill ${activeTab === tab ? 'active' : ''}`}
              >
                {tab === 'ALL' ? 'All Study Rooms' : `${tab} Track`}
              </button>
            ))}
          </div>

          {/* The Ledger Board Table */}
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>TRACK</th>
                  <th style={{ width: '110px' }}>CODE</th>
                  <th>STUDY ROOM & TOPIC</th>
                  <th style={{ width: '130px' }}>OCCUPANCY</th>
                  <th style={{ width: '110px' }}>TIMER</th>
                  <th style={{ width: '120px' }}>DAILY TARGET</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map(row => (
                  <tr key={row.code} className="ledger-row">
                    <td>
                      <span className={`badge ${row.badgeClass}`}>{row.category}</span>
                    </td>
                    <td>
                      <span className="code-stamp">{row.code}</span>
                    </td>
                    <td>
                      <div className="ledger-cell-title">{row.title}</div>
                      <div className="ledger-cell-sub">{row.syllabus}</div>
                    </td>
                    <td>
                      <div className="occupancy-wrap">
                        <span className="occupancy-val">{row.activeCount} / {row.maxCapacity}</span>
                        <div className="occupancy-bar">
                          <div
                            className="occupancy-fill"
                            style={{ width: `${(row.activeCount / row.maxCapacity) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cadence-tag">{row.cadence}</span>
                    </td>
                    <td>
                      <span className="pact-hours">{row.pactHours}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to="/signin" className="ledger-join-btn">
                        <span>Enter</span>
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 04: The Three Rules (Dossier Layout) */}
        <section id="three-rules" className="stage-section">
          <div className="section-brow">§ 04 / THE SYSTEM</div>
          <h2 className="stage-section-title">The three immutable principles of StudyPact</h2>
          <p className="stage-section-sub">
            Why traditional discord servers and study groups fail—and why synchronized discipline works.
          </p>

          <div className="principles-dossier-grid">
            <div className="dossier-block">
              <div className="dossier-index">RULE I</div>
              <h3 className="dossier-heading">Daily Goals Before Starting Your Study Session</h3>
              <p className="dossier-body">
                Set your daily study goals before joining the group. Clear targets keep you on track and motivated throughout the session.
              </p>
              <div className="dossier-footer-tag">STRUCTURED & FOCUSED STUDY SESSIONS</div>
            </div>

            <div className="dossier-block">
              <div className="dossier-index">RULE II</div>
              <h3 className="dossier-heading">Synchronized 50/10 Pomodoro Cycles</h3>
              <p className="dossier-body">
                Individual timers create friction. In StudyPact, the entire study room enters and exits focus periods simultaneously so everyone stays on track.
              </p>
              <div className="dossier-footer-tag">COLLECTIVE FOCUS & MUTUAL SUPPORT</div>
            </div>

            <div className="dossier-block">
              <div className="dossier-index">RULE III</div>
              <h3 className="dossier-heading">Daily Streaks & Social Accountability</h3>
              <p className="dossier-body">
                Consistency beats cramming. Study alongside dedicated friends, defend your daily streak, and build genuine study momentum together.
              </p>
              <div className="dossier-footer-tag">DAILY HABIT & REAL PROGRESS</div>
            </div>
          </div>
        </section>

        {/* Section 05: Daily Goals Block */}
        <section id="covenant" className="stage-section covenant-final-block">
          <div className="covenant-monolith">
            <div className="covenant-stamp">BUILT FOR FOCUSED STUDENTS</div>
            <h2 className="covenant-quote">
              "Consistent daily practice is the secret to cracking competitive exams. Study with peers who keep you motivated every day."
            </h2>
            <p className="covenant-attribution">
              Designed exclusively for aspirants of UPSC, GATE, JEE, NEET, and serious competitive examinations.
            </p>
            <div className="covenant-buttons">
              <Link to="/signup" className="btn btn-primary btn-lg cta-gold">
                <span>Join StudyPact &middot; Get Started Free</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="stage-footer">
          <div className="footer-meta-col">
            <div className="footer-wordmark">StudyPact</div>
            <p className="footer-sub">
              Study together, track daily goals, and stay accountable with focused peers. Built for deep work, non-negotiable targets, and long-distance discipline.
            </p>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">TRACKS</span>
            <span>UPSC Civil Services</span>
            <span>GATE Computer Science</span>
            <span>JEE Advanced</span>
            <span>NEET Medical</span>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">RESOURCES</span>
            <Link to="/signin">Sign In</Link>
            <Link to="/signup">Create Account</Link>
            <a href="#schedule-board">Live Directory</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

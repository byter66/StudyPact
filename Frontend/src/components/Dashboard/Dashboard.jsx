import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Flame,
  CheckCircle2,
  Circle,
  LogOut,
  Compass,
  Trophy,
  X,
  LayoutGrid,
  List,
  Clock,
  Check,
  Copy
} from "lucide-react";
import RoomCard, { CreateRoomCard } from "../RoomCard/RoomCard";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/apiClient";
import {
  getRoomByCode,
  getRooms,
  joinRoom,
} from "../../services/roomService";
import {
  completeDailyGoal,
  createDailyGoal,
  getDailyGoalLeaderboard,
  getTodayDailyGoals,
  getDailyGoalStreak,
  updateDailyGoal,
} from "../../services/dailyGoalService";
import "../common/Modal.css";
import "./Dashboard.css";

const MOCK_USER = { name: "Ananya", streakGoal: 14 };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXAM_FILTERS = ["All", "UPSC", "JEE", "NEET", "GATE"];
const QUICK_SUGGESTIONS = [
  "50 Practice MCQs",
  "Revise Formula Sheet",
  "Solve 10 Previous Year Questions",
  "Chapter Summary Notes",
];

const normalizeDailyGoal = (goal) => ({
  ...goal,
  isCompleted: goal?.isCompleted ?? goal?.completed ?? false,
});

function DailyProgressRing({ streak, completed, total }) {
  const size = 64;
  const stroke = 5.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(completed / total, 1) : (streak > 0 ? 1 : 0);
  const offset = circumference * (1 - progress);

  return (
    <div className="sp-dial-wrapper">
      <svg width={size} height={size} className="sp-dial-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-hairline, #E6E1D6)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-terracotta, #BA4A2B)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="sp-dial-center">
        <span className="sp-dial-streak">{streak}</span>
        <span className="sp-dial-unit">DAYS</span>
      </div>
    </div>
  );
}

function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);
  const [category, setCategory] = useState("UPSC");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name, maxMembers, category });
  };

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <form
        className="sp-modal-container sp-charter-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="sp-modal-header">
          <div>
            <span className="sp-charter-tag">NEW STUDY ROOM</span>
            <h3 className="sp-modal-title">Create a Study Room</h3>
          </div>
          <button
            type="button"
            className="sp-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sp-modal-body">
          <div className="sp-form-group">
            <label className="sp-form-label">Room Name *</label>
            <input
              type="text"
              className="sp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. UPSC Prelims Ethics Sprint"
              required
              autoFocus
            />
          </div>

          <div className="sp-form-group">
            <label className="sp-form-label">Exam / Category</label>
            <div className="sp-track-radio-group">
              {["UPSC", "GATE", "JEE", "NEET", "General"].map((track) => (
                <button
                  type="button"
                  key={track}
                  className={`sp-track-chip ${category === track ? "active" : ""}`}
                  onClick={() => setCategory(track)}
                >
                  {track}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-form-group sp-members-group">
            <div className="sp-slider-label-row">
              <label className="sp-form-label">Max Members</label>
              <span className="sp-capacity-badge">{maxMembers} Members</span>
            </div>
            <input
              type="range"
              min="2"
              max="12"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="sp-slider"
            />
            <p className="sp-form-hint">
              Smaller groups (4–6 members) work best for focused study sessions.
            </p>
          </div>
        </div>

        <div className="sp-modal-footer">
          <button
            type="button"
            className="sp-btn sp-btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="sp-btn sp-btn-primary">
            Create Room
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState("dossiers"); // "dossiers" | "board"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalText, setNewGoalText] = useState("");
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [dailyGoals, setDailyGoals] = useState([]);
  const [dailyGoalLoading, setDailyGoalLoading] = useState(false);
  const [dailyGoalError, setDailyGoalError] = useState("");
  const [streak, setStreak] = useState(0);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakError, setStreakError] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const loadRoomsRequestRef = useRef(0);

  const loadRooms = useCallback(async () => {
    const requestId = ++loadRoomsRequestRef.current;
    const requestUserId = user?.id;
    const isCurrentRequest = () => (
      requestId === loadRoomsRequestRef.current
      && requestUserId === user?.id
    );

    setRoomsLoading(true);
    try {
      const fetchedRooms = await getRooms();
      if (!isCurrentRequest()) return;
      setRooms(fetchedRooms);
      setRoomError("");
    } catch (error) {
      if (!isCurrentRequest()) return;
      setRoomError(error.message || "Unable to load rooms.");
    } finally {
      if (isCurrentRequest()) {
        setRoomsLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const loadAccountability = useCallback(async () => {
    setDailyGoalLoading(true);
    setStreakLoading(true);
    setLeaderboardLoading(true);
    setDailyGoalError("");
    setStreakError("");
    setLeaderboardError("");

    const [goalResult, streakResult, leaderboardResult] = await Promise.allSettled([
      getTodayDailyGoals(),
      getDailyGoalStreak(),
      getDailyGoalLeaderboard(),
    ]);

    if (goalResult.status === "fulfilled") {
      setDailyGoals((goalResult.value ?? []).map(normalizeDailyGoal));
    } else {
      setDailyGoalError("No daily goals recorded today yet.");
    }

    if (streakResult.status === "fulfilled") {
      setStreak(streakResult.value?.streak ?? 0);
      setStreakError("");
    } else {
      setStreakError("Unable to calculate streak.");
    }

    if (leaderboardResult.status === "fulfilled") {
      setLeaderboard(leaderboardResult.value ?? []);
      setLeaderboardError("");
    } else {
      setLeaderboardError("Unable to load leaderboard. Please try again.");
    }

    setDailyGoalLoading(false);
    setStreakLoading(false);
    setLeaderboardLoading(false);
  }, []);

  useEffect(() => {
    void loadAccountability();
  }, [loadAccountability]);

  const toggleDailyGoal = async (goalId) => {
    const goal = dailyGoals.find((item) => item.id === goalId);
    if (!goal) return;
    setDailyGoalError("");
    try {
      const completedGoal = await completeDailyGoal(goal.id);
      setDailyGoals((currentGoals) => currentGoals.map((item) => (
        item.id === completedGoal.id ? normalizeDailyGoal(completedGoal) : item
      )));
      await loadAccountability();
    } catch (error) {
      setDailyGoalError("Unable to complete today's goal. Please try again.");
      console.error("Unable to complete daily goal:", error);
    }
  };

  const saveDailyGoal = async (event) => {
    event.preventDefault();
    const title = newGoalText.trim();
    if (!title) return;

    setDailyGoalError("");
    try {
      const savedGoal = editingGoalId
        ? await updateDailyGoal(editingGoalId, title)
        : await createDailyGoal(title);
      setDailyGoals((currentGoals) => editingGoalId
        ? currentGoals.map((goal) => goal.id === editingGoalId ? normalizeDailyGoal(savedGoal) : goal)
        : [...currentGoals, normalizeDailyGoal(savedGoal)]);
      setNewGoalText("");
      setEditingGoalId(null);
      setShowAddGoal(false);
    } catch (error) {
      setDailyGoalError("Unable to save today's goal. Please try again.");
      console.error("Unable to save daily goal:", error);
    }
  };

  const handleCreateRoom = async ({ name, category }) => {
    setRoomError("");
    try {
      const result = await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          examCategory: category || (activeFilter === "All" ? "UPSC" : activeFilter),
          description: "",
        }),
      });

      const room = result.data;
      await loadRooms();
      setShowCreateModal(false);
      navigate(`/study-room/${room.id}`);
    } catch (error) {
      console.error("Unable to create room:", error);
      setRoomError(
        error.message?.includes("daily goal")
          ? "Add at least one daily goal before joining or creating a room."
          : error.message || "Unable to create this room.",
      );
    }
  };

  const handleEnterRoom = async (room) => {
    if (!UUID_PATTERN.test(room.id)) {
      setRoomError("This room is not connected to a real backend room yet.");
      return false;
    }

    setRoomError("");
    setJoiningRoomId(room.id);

    try {
      await joinRoom(room.id);
      navigate(`/study-room/${room.id}`);
      return true;
    } catch (error) {
      setRoomError(
        error.message?.includes("daily goal")
          ? "Add at least one daily goal before joining or creating a room."
          : error.message || "Unable to join this room.",
      );
      return false;
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleJoinByCode = async (event) => {
    event.preventDefault();
    const code = roomCode.trim();
    if (!code) return;

    setRoomError("");
    setJoiningByCode(true);

    try {
      const room = await getRoomByCode(code);
      const entered = await handleEnterRoom(room);
      if (entered) setRoomCode("");
    } catch (error) {
      setRoomError(
        error.message?.includes("daily goal")
          ? "Add at least one daily goal before joining or creating a room."
          : error.message || "Unable to find this room.",
      );
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleCopyCodeDirect = (e, code, id) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const visibleRooms =
    activeFilter === "All"
      ? rooms
      : rooms.filter((room) => room.examCategory === activeFilter);

  const displayName = user?.full_name || MOCK_USER.name;
  const initial = displayName.charAt(0).toUpperCase();
  const completedGoalsCount = dailyGoals.filter((goal) => goal.isCompleted).length;

  return (
    <div className="sp-station-shell">
      {/* ====================================================================
          TOP COCKPIT / COMMAND BAR
          ==================================================================== */}
      <header className="sp-station-bar">
        <div className="sp-station-bar-left">
          <Link to="/" className="sp-station-brand">
            <span className="sp-seal-stamp">SP</span>
            <div className="sp-brand-text-block">
              <span className="sp-brand-title">StudyPact</span>
              <span className="sp-station-mode-tag">PEER STUDY PLATFORM</span>
            </div>
          </Link>
          <div className="sp-station-status-pill" title="National sync operational">
            <span className="sp-status-pulse"></span>
            <span>CYCLE 2026/Q4 · LIVE</span>
          </div>
        </div>

        {/* Center: Quick Room Code + Navigation Rail */}
        <div className="sp-station-bar-center">
          <nav className="sp-station-nav-links">
            <span className="sp-station-nav-link active">
              <Compass size={14} /> Study Rooms
            </span>
          </nav>

          <form className="sp-station-keyport" onSubmit={handleJoinByCode}>
            <span className="sp-keyport-label">ROOM CODE:</span>
            <input
              className="sp-keyport-input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              maxLength={6}
              aria-label="Room code"
            />
            <button
              className="sp-keyport-submit"
              type="submit"
              disabled={joiningByCode || !roomCode.trim()}
            >
              {joiningByCode ? "..." : "ENTER ↵"}
            </button>
          </form>
        </div>

        {/* Right: Scholar Identity and Logout */}
        <div className="sp-station-bar-right">
          <div className="sp-scholar-pill">
            <div className="sp-scholar-avatar">{initial}</div>
            <div className="sp-scholar-meta">
              <span className="sp-scholar-name">{displayName}</span>
              <span className="sp-scholar-streak-badge">
                <Flame size={11} /> {streak}d Streak
              </span>
            </div>
          </div>

          <button
            className="sp-station-signout-btn"
            title="Sign out"
            onClick={async () => {
              await signOut();
              navigate("/signin");
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ====================================================================
          ASYMMETRIC TWO-WING WAR ROOM LAYOUT
          ==================================================================== */}
      <div className="sp-war-room">
        {/* ==================================================================
            LEFT WING: DAILY GOALS & LEADERBOARD (~360px)
            ================================================================== */}
        <aside className="sp-ledger-wing">
          {/* Section 1: Today's Study Covenant (Progress Dial) */}
          <div className="sp-covenant-box">
            <div className="sp-covenant-top">
              <div>
                <span className="sp-covenant-eyebrow">DAILY ACCOUNTABILITY</span>
                <h3 className="sp-covenant-title">Today's Goals</h3>
              </div>
              <DailyProgressRing
                streak={streakLoading ? 0 : streak}
                completed={completedGoalsCount}
                total={dailyGoals.length}
              />
            </div>

            <p className="sp-covenant-summary">
              {streakError
                ? streakError
                : dailyGoals.length > 0
                ? `${completedGoalsCount} of ${dailyGoals.length} goals completed today.`
                : "No goals set for today yet. Add your daily goals below."}
            </p>

            <div className="sp-covenant-footer">
              <span className="sp-covenant-lock-hint">
                <Clock size={12} /> Resets at midnight
              </span>
            </div>
          </div>

          {/* Section 2: The Daily Commitment Register */}
          <div className="sp-commitments-box">
            <div className="sp-commitments-header">
              <div>
                <h4 className="sp-commitments-title">Daily Tasks</h4>
                <p className="sp-commitments-sub">Your daily study checklist</p>
              </div>
              <span className="sp-commitments-badge">
                {dailyGoals.length ? `${completedGoalsCount}/${dailyGoals.length}` : "0"}
              </span>
            </div>

            {dailyGoalError && (
              <div className="sp-notice sp-notice-alert">{dailyGoalError}</div>
            )}

            {dailyGoalLoading ? (
              <div className="sp-commitments-loading">Loading daily goals...</div>
            ) : dailyGoals.length === 0 ? (
              <div className="sp-commitments-empty">
                <p className="sp-empty-lead">No goals added for today.</p>
                <p className="sp-empty-sub">
                  Set your daily study goals to stay focused and build your streak.
                </p>
              </div>
            ) : (
              <ul className="sp-indenture-list">
                {dailyGoals.map((goal, idx) => (
                  <li
                    key={goal.id}
                    className={`sp-indenture-clause ${goal.isCompleted ? "fulfilled" : ""}`}
                  >
                    <span className="sp-clause-serial">§ 0{idx + 1}</span>
                    <button
                      type="button"
                      className="sp-clause-check-btn"
                      onClick={() => toggleDailyGoal(goal.id)}
                      disabled={goal.isCompleted}
                      title={goal.isCompleted ? "Goal completed" : "Mark as completed"}
                    >
                      {goal.isCompleted ? (
                        <CheckCircle2 size={16} className="sp-checked-icon" />
                      ) : (
                        <Circle size={16} className="sp-circle-icon" />
                      )}
                    </button>
                    <span className="sp-clause-text">{goal.description}</span>
                    {!goal.isCompleted && (
                      <button
                        type="button"
                        className="sp-clause-edit-action"
                        onClick={() => {
                          setEditingGoalId(goal.id);
                          setNewGoalText(goal.description);
                          setShowAddGoal(true);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Quick target suggestion chips */}
            {showAddGoal && (
              <div className="sp-target-suggestions">
                <span className="sp-suggestions-label">Suggestions:</span>
                <div className="sp-suggestions-chips">
                  {QUICK_SUGGESTIONS.map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      className="sp-sug-chip"
                      onClick={() => setNewGoalText(sug)}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Goal Input Form or Trigger */}
            {showAddGoal ? (
              <form className="sp-indenture-form" onSubmit={saveDailyGoal}>
                <input
                  type="text"
                  className="sp-input sp-indenture-input"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder={editingGoalId ? "Update today's goal..." : "What are you studying today?..."}
                  autoFocus
                />
                <div className="sp-indenture-form-actions">
                  <button
                    type="button"
                    className="sp-btn sp-btn-ghost sp-btn-xs"
                    onClick={() => {
                      setNewGoalText("");
                      setEditingGoalId(null);
                      setShowAddGoal(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="sp-btn sp-btn-primary sp-btn-xs">
                    {editingGoalId ? "Update" : "Add Goal"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="sp-add-indenture-btn"
                onClick={() => setShowAddGoal(true)}
              >
                <Plus size={14} /> Add Daily Goal
              </button>
            )}
          </div>

          {/* Section 3: The Leaderboard (Honor Roll) */}
          <div className="sp-cadre-box">
            <div className="sp-cadre-header">
              <div>
                <h4 className="sp-cadre-title">Leaderboard</h4>
                <p className="sp-cadre-sub">Top study streaks</p>
              </div>
              <Trophy size={16} className="sp-cadre-trophy" />
            </div>

            {leaderboardLoading ? (
              <div className="sp-cadre-loading">Loading leaderboard...</div>
            ) : leaderboardError ? (
              <p className="sp-cadre-empty">{leaderboardError}</p>
            ) : leaderboard.length === 0 ? (
              <p className="sp-cadre-empty">No active streaks recorded yet. Complete today's goals to climb the board!</p>
            ) : (
              <ol className="sp-cadre-list">
                {leaderboard.slice(0, 5).map((entry, idx) => {
                  const isCurrent = entry.userId === user?.id;
                  const rankClass =
                    idx === 0
                      ? "rank-gold"
                      : idx === 1
                      ? "rank-silver"
                      : idx === 2
                      ? "rank-bronze"
                      : "rank-default";

                  return (
                    <li
                      key={entry.userId}
                      className={`sp-cadre-row ${isCurrent ? "is-current-scholar" : ""}`}
                    >
                      <span className={`sp-cadre-rank ${rankClass}`}>
                        0{idx + 1}
                      </span>
                      <div className="sp-cadre-name-group">
                        <span className="sp-cadre-name">{entry.name}</span>
                        {isCurrent && <span className="sp-cadre-you-badge">YOU</span>}
                      </div>
                      <span className="sp-cadre-streak">
                        <Flame size={11} className="sp-cadre-flame" />
                        {entry.streak}d
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>

        {/* ==================================================================
            RIGHT WING: STUDY ROOMS DIRECTORY (FLUID)
            ================================================================== */}
        <main className="sp-dispatch-stage">
          {/* Executive Mission Briefing Strip */}
          <section className="sp-dispatch-briefing">
            <div className="sp-briefing-info">
              <span className="sp-briefing-eyebrow">PEER STUDY GROUPS</span>
              <h1 className="sp-briefing-title">Study Rooms</h1>
              <p className="sp-briefing-sub">
                Join an active study room with synchronized Pomodoro timers, or create your own room for your study group.
              </p>
            </div>

            <div className="sp-briefing-actions">
              {/* View Switcher: Dossiers vs Schedule Board */}
              <div className="sp-view-toggle">
                <button
                  type="button"
                  className={`sp-toggle-btn ${viewMode === "dossiers" ? "active" : ""}`}
                  onClick={() => setViewMode("dossiers")}
                  title="Card View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`sp-toggle-btn ${viewMode === "board" ? "active" : ""}`}
                  onClick={() => setViewMode("board")}
                  title="Table View"
                >
                  <List size={15} />
                </button>
              </div>

              <button
                type="button"
                className="sp-btn sp-btn-primary sp-commission-btn"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> Create Room
              </button>
            </div>
          </section>

          {/* Exam Track Filter Rail */}
          <div className="sp-track-nav">
            <div className="sp-track-tabs">
              {EXAM_FILTERS.map((tag) => (
                <button
                  key={tag}
                  className={`sp-track-tab ${activeFilter === tag ? "active" : ""}`}
                  onClick={() => setActiveFilter(tag)}
                >
                  {tag === "All" ? "All Rooms" : `${tag} Rooms`}
                </button>
              ))}
            </div>
            <span className="sp-track-count">
              {visibleRooms.length} {visibleRooms.length === 1 ? "Room" : "Rooms"} Online
            </span>
          </div>

          {/* Urgent Briefing / Room Error Alert */}
          {roomError && (
            <div className="sp-notice sp-notice-alert sp-room-alert" role="alert">
              <strong>Notice:</strong> {roomError}
            </div>
          )}

          {/* Loading State */}
          {roomsLoading && (
            <div className="sp-dispatch-loading">
              <div className="sp-spinner"></div>
              <span>Loading study rooms...</span>
            </div>
          )}

          {/* ================================================================
              VIEW MODE 1: CHAMBER DOSSIER CARDS (RESTRUCTURED)
              ================================================================ */}
          {!roomsLoading && viewMode === "dossiers" && (
            <div className="sp-dossiers-stack">
              {visibleRooms.map((room, idx) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={idx}
                  onEnter={handleEnterRoom}
                  disabled={joiningRoomId === room.id}
                />
              ))}

              {visibleRooms.length === 0 && (
                <div className="sp-dispatch-empty">
                  <div className="sp-empty-monogram">§</div>
                  <h3 className="sp-empty-title">
                    No study rooms found for {activeFilter}
                  </h3>
                  <p className="sp-empty-desc">
                    Be the first to start a study room for {activeFilter}. Set your session goals and invite your peers to join.
                  </p>
                  <button
                    className="sp-btn sp-btn-primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus size={15} /> Create {activeFilter} Room
                  </button>
                </div>
              )}

              {/* Commission Card Anchor */}
              {visibleRooms.length > 0 && (
                <CreateRoomCard onCreate={() => setShowCreateModal(true)} />
              )}
            </div>
          )}

          {/* ================================================================
              VIEW MODE 2: SCHEDULE BOARD / REGISTRY TABLE (NEW DESIGN PATTERN)
              ================================================================ */}
          {!roomsLoading && viewMode === "board" && (
            <div className="sp-board-table-container">
              {visibleRooms.length === 0 ? (
                <div className="sp-dispatch-empty">
                  <div className="sp-empty-monogram">§</div>
                  <h3 className="sp-empty-title">No rooms found for {activeFilter}</h3>
                  <p className="sp-empty-desc">Create a study room to start this board.</p>
                </div>
              ) : (
                <table className="sp-board-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>TRACK</th>
                      <th>ROOM NAME</th>
                      <th>TOPIC / FOCUS</th>
                      <th style={{ width: "130px" }}>ROOM CODE</th>
                      <th style={{ width: "120px" }}>MEMBERS</th>
                      <th style={{ width: "130px", textAlign: "right" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRooms.map((room) => {
                      const maxCap = room.maxMembers || 6;
                      const count = room.memberCount || Math.min(Math.max((room.id ? (room.id.charCodeAt(0) % 5) + 1 : 2), 1), maxCap);
                      const isJoining = joiningRoomId === room.id;

                      return (
                        <tr
                          key={room.id}
                          className="sp-board-row"
                          onClick={() => !isJoining && handleEnterRoom(room)}
                        >
                          <td>
                            <span className="sp-board-track-tag">
                              {room.examCategory || "General"}
                            </span>
                          </td>
                          <td>
                            <div className="sp-board-room-name">{room.name}</div>
                            <span className="sp-board-sub">Sync Active · 25m Focus</span>
                          </td>
                          <td className="sp-board-desc-cell">
                            {room.description || "General syllabus revision & peer accountability"}
                          </td>
                          <td>
                            {room.roomCode ? (
                              <button
                                type="button"
                                className="sp-board-key-btn"
                                onClick={(e) => handleCopyCodeDirect(e, room.roomCode, room.id)}
                                title="Copy room code"
                              >
                                <code>{room.roomCode}</code>
                                {copiedCodeId === room.id ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            ) : "—"}
                          </td>
                          <td>
                            <div className="sp-board-occupancy">
                              <span className="sp-occupancy-num">{count}/{maxCap}</span>
                              <div className="sp-occupancy-mini-bar">
                                <div
                                  className="sp-occupancy-mini-fill"
                                  style={{ width: `${(count / maxCap) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="sp-board-enter-btn"
                              disabled={isJoining}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnterRoom(room);
                              }}
                            >
                              {isJoining ? "Entering..." : "Enter ↗"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
}

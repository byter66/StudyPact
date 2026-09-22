import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RoomCard from "../RoomCard/RoomCard";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/apiClient";
import { joinRoom } from "../../services/roomService";
import "./Dashboard.css";

// --- Mock data. Swap for real Supabase shapes once Niveditha/Mahima confirm the schema. ---
const MOCK_USER = { name: "Ananya", streak: 12, streakGoal: 14, rank: 8 };

const EXAM_FILTERS = ["All", "UPSC", "JEE", "NEET", "GATE"];

const MOCK_ROOMS = [
  { id: "r1", examTag: "UPSC", title: "Prelims Revision Pact", members: ["Riya", "Karan", "Sana"], isLive: true },
  { id: "r2", examTag: "GATE", title: "CS Core Subjects", members: ["Arjun", "Divya"], isLive: false },
  { id: "r3", examTag: "NEET", title: "Biology Daily Grind", members: ["Meera", "Faisal", "Om", "Priya", "Tara"], isLive: true },
  { id: "r4", examTag: "JEE", title: "Physics Problem Set", members: ["Nikhil"], isLive: false },
];

const MOCK_LEADERBOARD = [
  { name: "Sana", streak: 21 },
  { name: "Karan", streak: 18 },
  { name: "You", streak: 12 },
  { name: "Divya", streak: 9 },
];

const MOCK_GOALS = [
  { id: "g1", text: "2 hours — Prelims revision", done: true },
  { id: "g2", text: "Solve 1 mock doubt", done: false },
  { id: "g3", text: "30 min current affairs", done: false },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function StreakRing({ value, goal }) {
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / goal, 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="streak-ring">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDE6D9" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#5C6B3F"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="streak-ring-label">
        <span className="streak-ring-number">{value}</span>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  return <span className="avatar-icon">{name.charAt(0).toUpperCase()}</span>;
}

function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name, maxMembers, password });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Create room</h3>

        <label className="modal-field">
          <span>Name*</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Prelims Revision Pact"
            required
          />
        </label>

        <label className="modal-field">
          <span>Max members* — {maxMembers}</span>
          <input
            type="range"
            min="2"
            max="20"
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
          />
        </label>

        <label className="modal-field">
          <span>Password (optional)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank for open room"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [goals, setGoals] = useState(MOCK_GOALS);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [roomError, setRoomError] = useState("");

  const toggleGoal = (id) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  };

  const handleCreateRoom = async ({ name }) => {
    try {
      const result = await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          examCategory: activeFilter === "All" ? "UPSC" : activeFilter,
          description: "",
        }),
      });

      const room = result.data;
      const newRoom = {
        id: room.id,
        examTag: room.examCategory,
        title: room.name,
        members: [user?.full_name || MOCK_USER.name],
        isLive: false,
      };

      const handleEnterRoom = async (room) => {
        if (!UUID_PATTERN.test(room.id)) {
          setRoomError("This room is not connected to a real backend room yet.");
          return;
        }

        setRoomError("");
        setJoiningRoomId(room.id);

        try {
          await joinRoom(room.id);
          navigate(`/study-room/${room.id}`);
        } catch (error) {
          setRoomError(error.message || "Unable to join this room.");
        } finally {
          setJoiningRoomId(null);
        }
      };

      setRooms((prev) => [newRoom, ...prev]);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Unable to create room:", error);
    }
  };

  const visibleRooms =
    activeFilter === "All" ? rooms : rooms.filter((r) => r.examTag === activeFilter);

  const completedCount = goals.filter((g) => g.done).length;
  const displayName = user?.full_name || MOCK_USER.name;

  return (
    <div className={`dashboard-shell ${menuOpen ? "sidebar-open" : ""}`}>
      <button
        className="mobile-menu-btn"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        ☰
      </button>

      <aside className="dashboard-sidebar-nav">
        <div className="sidebar-top">
          <span className="sidebar-icon sidebar-menu" aria-hidden="true">☰</span>
          <span className="sidebar-avatar" title={displayName}>
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="sidebar-rank">Rank #{MOCK_USER.rank}</span>
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-icon-btn" title="Settings" aria-label="Settings">⚙️</button>
          <button
            className="sidebar-logout"
            onClick={async () => {
              await signOut();
              navigate('/signin');
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="dashboard-main-area">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Welcome back</p>
            <h1 className="dashboard-greeting">{displayName}</h1>
          </div>
          <StreakRing value={MOCK_USER.streak} goal={MOCK_USER.streakGoal} />
        </header>

        <section className="dashboard-rooms-section">
          <div className="rooms-section-toprow">
            <h2>Available rooms</h2>
          </div>

          <div className="rooms-controls-row">
            <div className="exam-pill-row">
              {EXAM_FILTERS.map((tag) => (
                <button
                  key={tag}
                  className={`exam-pill ${activeFilter === tag ? "exam-pill-active" : ""}`}
                  onClick={() => setActiveFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <button className="create-room-btn" onClick={() => setShowCreateModal(true)}>
              + Create room
            </button>
          </div>

          {roomError && (
            <p role="alert" className="dashboard-empty">
              {roomError}
            </p>
          )}

          <div className="room-grid">
            {visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                disabled={joiningRoomId === room.id}
                onEnter={handleEnterRoom}
              />
            ))}
            {visibleRooms.length === 0 && (
              <p className="dashboard-empty">No rooms yet for {activeFilter}. Start one above.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panels">
          <div className="dashboard-card">
            <h3>Daily goal</h3>
            <p className="dashboard-card-subtext">
              Set your daily goal — {completedCount}/{goals.length} complete
            </p>
            <ul className="goal-list">
              {goals.map((goal) => (
                <li key={goal.id} className="goal-item">
                  <label>
                    <input type="checkbox" checked={goal.done} onChange={() => toggleGoal(goal.id)} />
                    <span className={goal.done ? "goal-done" : ""}>{goal.text}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="goal-hint">Checklist items are what count toward streak completion.</p>
          </div>

          <div className="dashboard-card">
            <h3>Leaderboard</h3>
            <ul className="leaderboard-list">
              {MOCK_LEADERBOARD.map((entry, i) => (
                <li
                  key={entry.name}
                  className={`leaderboard-item ${entry.name === "You" ? "leaderboard-you" : ""}`}
                >
                  <span className="leaderboard-rank">{i + 1}</span>
                  <Avatar name={entry.name} />
                  <span className="leaderboard-name">Streak day {entry.streak}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {showCreateModal && (
        <CreateRoomModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateRoom} />
      )}
    </div>
  );
}
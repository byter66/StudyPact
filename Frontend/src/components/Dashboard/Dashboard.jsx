import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RoomCard from "../RoomCard/RoomCard";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/apiClient";
import { getRoomByCode, getRooms, joinRoom } from "../../services/roomService";
import {
  createUserTask,
  getUserTasks,
  updateUserTask,
} from "../../services/userTaskService";
import "./Dashboard.css";

const MOCK_USER = { name: "Ananya", streak: 12, streakGoal: 14, rank: 8 };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXAM_FILTERS = ["All", "UPSC", "JEE", "NEET", "GATE"];

const EMPTY_TASKS_MESSAGE = "Your tasks will appear here. Create a task to get started.";
const TASKS_LOAD_ERROR =
  "Tasks are temporarily unavailable. Please retry; if this continues, check the task database setup.";

const MOCK_LEADERBOARD = [
  { name: "Sana", streak: 21 },
  { name: "Karan", streak: 18 },
  { name: "You", streak: 12 },
  { name: "Divya", streak: 9 },
];

function DailyProgressRing({ streak, completed, total }) {
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(completed / total, 1) : 0;
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
        <span className="streak-ring-number">{streak}</span>
      </div>
    </div>
  );
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
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalText, setNewGoalText] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [roomError, setRoomError] = useState("");

  const loadRooms = async () => {
    setRoomsLoading(true);
    try {
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);
      setRoomError("");
    } catch (error) {
      setRoomError(error.message || "Unable to load rooms.");
    } finally {
      setRoomsLoading(false);
    }
  };

  const loadTasks = async () => {
    setTasksLoading(true);
    setTasksError("");
    try {
      setTasks(await getUserTasks());
    } catch (error) {
      setTasksError(TASKS_LOAD_ERROR);
      console.error("Unable to load user tasks:", error);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    loadTasks();
  }, []);

  const toggleTask = async (task) => {
    setTasksError("");
    try {
      const updatedTask = await updateUserTask(task.id, {
        completed: !task.completed,
      });
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id ? updatedTask : currentTask
        )
      );
    } catch (error) {
      setTasksError("Unable to update this task. Please try again.");
      console.error("Unable to update user task:", error);
    }
  };

  const addTask = async (event) => {
    event.preventDefault();
    const title = newGoalText.trim();

    if (!title) return;

    setTasksError("");
    try {
      const task = await createUserTask(title);
      setTasks((currentTasks) => [...currentTasks, task]);
      setNewGoalText("");
      setShowAddGoal(false);
    } catch (error) {
      setTasksError("Unable to add this task. Please try again.");
      console.error("Unable to create user task:", error);
    }
  };

  const handleCreateRoom = async ({ name }) => {
    if (!tasksLoading && !tasksError && tasks.length === 0) {
      setShowCreateModal(false);
      setRoomError("Add at least one task on your dashboard before creating a room.");
      return;
    }

    setRoomError("");
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
      await loadRooms();
      setShowCreateModal(false);
      navigate(`/study-room/${room.id}`);
    } catch (error) {
      console.error("Unable to create room:", error);
      setRoomError(error.message || "Unable to create this room.");
    }
  };

  const handleEnterRoom = async (room) => {
    if (!tasksLoading && !tasksError && tasks.length === 0) {
      setRoomError("Add at least one task on your dashboard before joining a room.");
      return false;
    }

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
      setRoomError(error.message || "Unable to join this room.");
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
      setRoomError(error.message || "Unable to find this room.");
    } finally {
      setJoiningByCode(false);
    }
  };

  const visibleRooms =
    activeFilter === "All"
      ? rooms
      : rooms.filter((room) => room.examCategory === activeFilter);

  const completedCount = tasks.filter((task) => task.completed).length;
  const displayName = user?.full_name || MOCK_USER.name;
  const tasksEmpty = tasks.length === 0;

  return (
    <div className={`dashboard-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <button
        className="mobile-menu-btn"
        aria-label="Toggle menu"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        ☰
      </button>

      <aside className="dashboard-sidebar-nav">
        <div className="sidebar-top">
          <button
            className="sidebar-icon sidebar-menu"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
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
          <DailyProgressRing
            streak={MOCK_USER.streak}
            completed={completedCount}
            total={tasks.length}
          />
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
            <form className="join-room-form" onSubmit={handleJoinByCode}>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder="Room code"
                aria-label="Room code"
                maxLength={6}
              />
              <button className="btn btn-ghost" type="submit" disabled={joiningByCode}>
                {joiningByCode ? "Joining..." : "Join"}
              </button>
            </form>
          </div>
          {roomError && (
            <p className="dashboard-room-error" role="alert">
              {roomError}
            </p>
          )}

          <div className="room-grid">
            {roomsLoading && <p className="dashboard-empty">Loading rooms...</p>}
            {!roomsLoading && visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEnter={handleEnterRoom}
                disabled={joiningRoomId === room.id}
              />
            ))}
            {!roomsLoading && visibleRooms.length === 0 && (
              <p className="dashboard-empty">No rooms yet for {activeFilter}. Start one above.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panels">
          <div className="dashboard-card">
            <h3>My tasks</h3>
            <p className="dashboard-card-subtext">
              {completedCount}/{tasks.length} complete
            </p>
            {tasksError && (
              <p className="dashboard-room-error" role="alert">{tasksError}</p>
            )}
            {tasksLoading ? (
              <p className="dashboard-card-subtext" role="status">Loading tasks...</p>
            ) : tasksError ? (
              <button type="button" className="goal-add-button" onClick={loadTasks}>
                Retry loading tasks
              </button>
            ) : tasksEmpty ? (
              <div className="dashboard-goal-empty-state" aria-live="polite">
                <p>{EMPTY_TASKS_MESSAGE}</p>
              </div>
            ) : (
              <ul className="goal-list">
                {tasks.map((task) => (
                  <li key={task.id} className="goal-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task)}
                      />
                      <span className={task.completed ? "goal-done" : ""}>{task.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {showAddGoal ? (
              <form className="goal-add-form" onSubmit={addTask}>
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(event) => setNewGoalText(event.target.value)}
                  placeholder="Enter a task"
                  aria-label="New task"
                  autoFocus
                />
                <button type="submit" className="goal-add-submit">Add</button>
                <button
                  type="button"
                  className="goal-add-cancel"
                  onClick={() => {
                    setNewGoalText("");
                    setShowAddGoal(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="goal-add-button"
                onClick={() => setShowAddGoal(true)}
              >
                + Add task
              </button>
            )}
          </div>

          <div className="dashboard-card">
            <h3>Leaderboard</h3>
            <ul className="leaderboard-list">
              {MOCK_LEADERBOARD.map((entry, index) => (
                <li
                  key={entry.name}
                  className={`leaderboard-item ${entry.name === "You" ? "leaderboard-you" : ""}`}
                >
                  <span className="leaderboard-rank">{index + 1}</span>
                  <span className="leaderboard-name">{entry.name}</span>
                  <span className="leaderboard-streak">🔥 {entry.streak} days</span>
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
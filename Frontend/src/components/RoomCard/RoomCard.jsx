import "./RoomCard.css";

// examTag drives the small corner label + accent color per exam type.
// Keep this list in sync with whatever exam categories the backend sends.
const EXAM_STYLES = {
  UPSC: { label: "UPSC", tint: "tint-a" },
  GATE: { label: "GATE", tint: "tint-b" },
  NEET: { label: "NEET", tint: "tint-c" },
  JEE: { label: "JEE", tint: "tint-d" },
  CAT: { label: "CAT", tint: "tint-e" },
  SSC: { label: "SSC", tint: "tint-f" },
};

export default function RoomCard({ room, onEnter, disabled = false }) {
  const exam = EXAM_STYLES[room.examTag] || { label: room.examTag, tint: "tint-a" };

  // Dashboard now only ever passes rooms with at least one active member,
  // so every card rendered here IS live by definition — no need to branch.
  const activeCount = room.activeMembers?.length || 0;

  return (
    <button
      className={`room-card ${exam.tint}`}
      aria-label={`Join room ${room.title}`}
      disabled={disabled}
      onClick={() => onEnter?.(room)}
    >
      <div className="room-card-top">
        <span className="room-card-tag">{exam.label}</span>
        <span className="room-card-live">● Live</span>
      </div>

      <h3 className="room-card-title">{room.title}</h3>

      <div className="room-card-meta">
        <div className="room-card-avatars">
          {room.members.slice(0, 4).map((m, i) => {
            const memberIsActive = room.activeMembers?.includes(m);
            return (
              <span
                key={i}
                className={`room-card-avatar ${memberIsActive ? "is-active" : "is-inactive"}`}
                title={memberIsActive ? `${m} — studying now` : `${m} — not active`}
              >
                {m.charAt(0).toUpperCase()}
              </span>
            );
          })}
          {room.members.length > 4 && (
            <span className="room-card-avatar room-card-avatar-more">
              +{room.members.length - 4}
            </span>
          )}
        </div>
        <span className="room-card-count">
          {activeCount} of {room.members.length} studying now
        </span>
      </div>
    </button>
  );
}

export function CreateRoomCard({ onCreate }) {
  return (
    <button className="room-card room-card-create" onClick={onCreate}>
      <span className="room-card-create-plus">+</span>
      <span className="room-card-create-label">Create room</span>
    </button>
  );
}
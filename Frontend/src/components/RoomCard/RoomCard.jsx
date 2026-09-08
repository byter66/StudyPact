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

export default function RoomCard({ room, onEnter }) {
  const exam = EXAM_STYLES[room.examTag] || { label: room.examTag, tint: "tint-a" };

  return (
    <button className={`room-card ${exam.tint}`} onClick={() => onEnter?.(room)}>
      <div className="room-card-top">
        <span className="room-card-tag">{exam.label}</span>
        {room.isLive && <span className="room-card-live">● Live</span>}
      </div>

      <h3 className="room-card-title">{room.title}</h3>

      <div className="room-card-meta">
        <div className="room-card-avatars">
          {room.members.slice(0, 4).map((m, i) => (
            <span key={i} className="room-card-avatar" title={m}>
              {m.charAt(0).toUpperCase()}
            </span>
          ))}
          {room.members.length > 4 && (
            <span className="room-card-avatar room-card-avatar-more">
              +{room.members.length - 4}
            </span>
          )}
        </div>
        <span className="room-card-count">{room.members.length} studying</span>
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
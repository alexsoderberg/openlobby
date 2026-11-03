import type { CSSProperties } from "react";
import { useReveal } from "../../hooks";
import { useMessages } from "../../i18n";

// Generic sample data only: the preview must never show a real member.
const SAMPLE_MEMBERS = ["Jordan Lee", "Casey Morgan", "Sam Rivera"];
const ADMIN_MEMBER = SAMPLE_MEMBERS[0];
const SAMPLE_INVITE_SHARE = 0.3;

/** A static picture of the group page. Hidden from assistive technology, since it is not interactive. */
export function LandingPreview() {
  const m = useMessages();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div ref={revealRef} className="preview-grid" aria-hidden="true">
      <div className="preview">
        {SAMPLE_MEMBERS.map((name) => (
          <div key={name} className="preview__member">
            <span className="preview__avatar" />
            {name}
            {name === ADMIN_MEMBER && (
              <span className="badge">{m.groupAdminMarker}</span>
            )}
          </div>
        ))}
      </div>
      <div className="preview">
        <p className="preview__title">{m.inviteLinksHeading}</p>
        <div
          className="meter"
          style={{ "--meter-value": SAMPLE_INVITE_SHARE } as CSSProperties}
        >
          <span />
        </div>
      </div>
    </div>
  );
}

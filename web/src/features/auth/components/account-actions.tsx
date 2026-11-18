import { useId } from 'react';
import { Icon, type IconName } from '../../../ui/icon.tsx';
import { signOut } from '../api/session.ts';
import { CHANGE_DIALOG } from './my-roles.tsx';
import styles from './account.module.css';

interface Tile {
  icon: IconName;
  title: string;
  text: string;
}
function TileBody({ icon, title, text, textId }: Tile & { textId: string }) {
  return (
    <>
      <span className={styles.tileIcon}>
        <Icon name={icon} />
      </span>
      <span className={styles.tileTitle}>{title}</span>
      <span id={textId} className={styles.tileText}>
        {text}
      </span>
    </>
  );
}

function ActionTile({ tile, run }: { tile: Tile; run: () => void }) {
  const textId = useId();
  return (
    <button
      type="button"
      className={styles.tile}
      aria-label={tile.title}
      aria-describedby={textId}
      onClick={run}
    >
      <TileBody {...tile} textId={textId} />
    </button>
  );
}

interface Props {
  /** Null when change requests are not available yet: then only sign-out is offered. */
  edit: (() => void) | null;
  askChange: boolean;
}
/** The personal area's actions as three equal tiles (one clear target each). */
export function AccountActions({ edit, askChange }: Props) {
  const signOutText = useId();
  return (
    <section aria-label="פעולות" className={styles.tiles}>
      {edit && (
        <ActionTile
          tile={{
            icon: 'pencil',
            title: 'עריכת הפרטים שלי',
            text: 'שם, תפקיד או טלפון. השינוי נשלח לאישור מנהל.',
          }}
          run={edit}
        />
      )}
      {askChange && (
        <ActionTile
          tile={{
            icon: 'shield',
            title: 'בקשה לשינוי תפקיד או יחידה',
            text: 'תפקיד נוסף, הסרת תפקיד או מעבר יחידה.',
          }}
          run={() => {
            const dialog = document.getElementById(CHANGE_DIALOG);
            if (dialog instanceof HTMLDialogElement) dialog.showModal();
          }}
        />
      )}
      <form action={signOut} className={styles.tileForm}>
        <button
          type="submit"
          className={`${styles.tile ?? ''} ${styles.quietTile ?? ''}`}
          aria-label="יציאה מהמערכת"
          aria-describedby={signOutText}
        >
          <TileBody
            icon="logout"
            title="יציאה מהמערכת"
            text="סיום ההתחברות בדפדפן הזה."
            textId={signOutText}
          />
        </button>
      </form>
    </section>
  );
}

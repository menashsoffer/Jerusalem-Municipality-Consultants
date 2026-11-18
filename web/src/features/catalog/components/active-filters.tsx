import { Button } from '../../../ui/button.tsx';
import { Icon } from '../../../ui/icon.tsx';
import type { Filters } from '../../../catalog-filter.ts';
import type { Supplier } from '../../../catalog-model.ts';
import { activeTags, type ActiveTag } from '../model/filter-groups.ts';
import styles from './catalog.module.css';

interface Props {
  filters: Filters;
  suppliers: Supplier[];
  remove: (key: ActiveTag['key']) => void;
  clear: () => void;
}

/** What is filtered right now, each with its own ×; nothing when no filter is set. */
export function ActiveFilters({ filters, suppliers, remove, clear }: Props) {
  const tags = activeTags(filters, suppliers);
  if (!tags.length) return null;
  return (
    <div className={styles.active}>
      <ul aria-label="מסננים פעילים" className={styles.tags}>
        {tags.map((tag) => (
          <li key={tag.key} className={styles.tag}>
            {tag.text}
            <button
              type="button"
              className={styles.tagRemove}
              aria-label={`הסרת המסנן ${tag.text}`}
              onClick={() => {
                remove(tag.key);
              }}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="quiet" onClick={clear}>
        ניקוי הכול
      </Button>
    </div>
  );
}

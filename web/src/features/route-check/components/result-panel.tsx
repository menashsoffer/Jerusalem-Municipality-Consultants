import { StatusMessage } from '../../../ui/status-message.tsx';
import { STATUS_LABELS, routeLabel, money, type CheckResult } from '../model/result.ts';
interface MessagesProps {
  title: string;
  items: string[];
}
function Messages({ title, items }: MessagesProps) {
  return items.length ? (
    <section>
      <h3>{title}</h3>
      <ul>
        {[...new Set(items)].map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </section>
  ) : null;
}
interface Props {
  result: CheckResult;
}
export function ResultPanel({ result }: Props) {
  return (
    <>
      <StatusMessage>{STATUS_LABELS[result.status]}</StatusMessage>
      <h3>{routeLabel(result.route)}</h3>
      <p>
        אסמכתה משפטית: <bdi>{result.regulation}</bdi>
      </p>
      <p>הגורם המוסמך למסלול: {result.approver}</p>
      {result.comparedValue !== null && (
        <p>
          הסכום שנבדק מול הספים: <bdi>{money(result.comparedValue)}</bdi>
        </p>
      )}
      <p>מקור הספים: {result.thresholdsSource ?? 'לא תועד מקור לספים.'}</p>
      <Messages title="דרישות המסלול" items={result.requirements} />
      <Messages title="נתונים חסרים" items={result.missing} />
      <Messages title="הערות לבדיקה" items={result.warnings} />
    </>
  );
}

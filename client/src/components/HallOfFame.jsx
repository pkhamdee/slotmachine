import { useState, useEffect } from 'react';
import { getHallOfFame } from '../api/gameApi.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function HallOfFame({ refreshTrigger }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    getHallOfFame(3).then(setEntries).catch(console.error);
  }, [refreshTrigger]);

  return (
    <div className="hof-portlet">
      <h2 className="hof-portlet__title">🏛 Hall of Fame</h2>
      {entries.length === 0 ? (
        <p className="hof-portlet__empty">No winners yet</p>
      ) : (
        <ol className="hof-portlet__list">
          {entries.map((e, i) => (
            <li key={e.playerName} className="hof-portlet__item">
              <span className="hof-portlet__medal">{MEDALS[i]}</span>
              <span className="hof-portlet__name">{e.playerName}</span>
              <span className="hof-portlet__wins">{e.wins} win{e.wins !== 1 ? 's' : ''}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

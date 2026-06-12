import { useEffect, useRef, useState } from 'react';
import { GitCompare, Plus, Minus, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateTerraform } from '../utils/terraformGenerator';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNum: number;
}

function computeDiff(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table (limit size for performance)
  const maxLines = 300;
  const oLines = oldLines.slice(0, maxLines);
  const nLines = newLines.slice(0, maxLines);

  const dp: number[][] = Array.from({ length: oLines.length + 1 }, () =>
    new Array(nLines.length + 1).fill(0)
  );

  for (let i = 1; i <= oLines.length; i++) {
    for (let j = 1; j <= nLines.length; j++) {
      if (oLines[i - 1] === nLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = oLines.length, j = nLines.length;
  const ops: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oLines[i - 1] === nLines[j - 1]) {
      ops.unshift({ type: 'unchanged', content: oLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', content: nLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'removed', content: oLines[i - 1] });
      i--;
    }
  }

  // Add remaining lines if truncated
  if (m > maxLines) {
    for (let k = maxLines; k < m; k++) {
      ops.push({ type: 'removed', content: oldLines[k] });
    }
  }
  if (n > maxLines) {
    for (let k = maxLines; k < n; k++) {
      ops.push({ type: 'added', content: newLines[k] });
    }
  }

  let lineNum = 1;
  return ops.map(op => ({ ...op, lineNum: lineNum++ }));
}

export default function DiffPanel() {
  const { nodes, providerRegion, providerProfile } = useStore();
  const [snapshot, setSnapshot] = useState<string>('');
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const currentCode = generateTerraform(nodes, providerRegion, providerProfile);
  const prevCodeRef = useRef(currentCode);

  // Auto-compute diff when code changes
  useEffect(() => {
    if (hasSnapshot && snapshot) {
      setDiff(computeDiff(snapshot, currentCode));
    }
  }, [currentCode, snapshot, hasSnapshot]);

  const handleTakeSnapshot = () => {
    setSnapshot(currentCode);
    setHasSnapshot(true);
    setDiff([]);
    prevCodeRef.current = currentCode;
  };

  const handleReset = () => {
    setSnapshot('');
    setHasSnapshot(false);
    setDiff([]);
  };

  const added   = diff.filter(l => l.type === 'added').length;
  const removed = diff.filter(l => l.type === 'removed').length;
  const noChanges = hasSnapshot && diff.every(l => l.type === 'unchanged');

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-purple-950/50 to-gray-900">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">Diff View</span>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">
          Take a snapshot, then make changes to see what's different.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleTakeSnapshot}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded-lg transition-colors font-semibold"
          >
            <GitCompare size={12} />
            {hasSnapshot ? 'New Snapshot' : 'Take Snapshot'}
          </button>
          {hasSnapshot && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>

        {hasSnapshot && (
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <Plus size={10} /> {added} added
            </span>
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <Minus size={10} /> {removed} removed
            </span>
          </div>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {!hasSnapshot && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <GitCompare size={32} className="text-gray-600 mb-3" />
            <p className="text-gray-400 font-semibold text-sm">No snapshot yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Click "Take Snapshot" to capture the current state, then make changes to see the diff.
            </p>
          </div>
        )}

        {hasSnapshot && noChanges && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <RefreshCw size={28} className="text-gray-600 mb-3" />
            <p className="text-gray-400 font-semibold text-sm">No changes</p>
            <p className="text-gray-600 text-xs mt-1">
              Make changes to resources to see the diff here.
            </p>
          </div>
        )}

        {hasSnapshot && !noChanges && diff.length > 0 && (
          <div>
            {diff.map((line, i) => {
              if (line.type === 'unchanged') return null; // only show changed lines + context
              return (
                <div
                  key={i}
                  className={`flex items-start px-2 py-0.5 ${
                    line.type === 'added'
                      ? 'bg-green-950/40 border-l-2 border-green-500'
                      : 'bg-red-950/40 border-l-2 border-red-500'
                  }`}
                >
                  <span className={`w-4 flex-shrink-0 ${line.type === 'added' ? 'text-green-400' : 'text-red-400'}`}>
                    {line.type === 'added' ? '+' : '-'}
                  </span>
                  <span className={`flex-1 whitespace-pre-wrap break-all ${line.type === 'added' ? 'text-green-300' : 'text-red-300'}`}>
                    {line.content || ' '}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-700">
        <p className="text-[9px] text-gray-600 text-center">
          Snapshot vs current canvas state
        </p>
      </div>
    </div>
  );
}

import { useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import Sidebar from '../components/Sidebar';
import CostComparisonPanel from '../components/CostComparisonPanel';
import Header from '../components/Header';
import { ResourceDefinition } from '../types/resources';

export default function CostComparisonDashboard() {
  useEffect(() => {
    useStore.getState().setCloudProvider('costcompare');
  }, []);

  const handleDragStart = useCallback((_e: React.DragEvent, _definition: ResourceDefinition) => {
    // CostCompareSidebar handles its own drag start internally
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-enter">
      <Header dashboard="costcompare" />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          fixedMode="costcompare"
          onDragStart={handleDragStart}
          onOpenBlueprints={() => {}}
        />
        <div className="flex-1 overflow-hidden">
          <CostComparisonPanel />
        </div>
      </div>
    </div>
  );
}

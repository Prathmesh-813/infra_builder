import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import Header from '../components/Header';
import OptimizationPanel from '../components/OptimizationPanel';

export default function OptimizationDashboard() {
  useEffect(() => {
    useStore.getState().setCloudProvider('aws');
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-enter">
      <Header dashboard="costcompare" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <OptimizationPanel />
        </div>
      </div>
    </div>
  );
}

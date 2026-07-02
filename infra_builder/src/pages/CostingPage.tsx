import "../styles/kubernetes.css";
import { CostingExplorer } from "../components/costing/CostingExplorer";

export default function CostingPage() {
  return (
    <div className="k8s-root" style={{ overflowY: "auto", height: "100%", padding: "1.5rem" }}>
      <CostingExplorer />
    </div>
  );
}

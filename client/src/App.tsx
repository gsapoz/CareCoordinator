import { Outlet } from "react-router-dom";
export default function App() {
  return (
    <div style={{ padding: 1 }}>
      <Outlet />    {/* Render Client Layer (Frontend) */}
    </div>
  );
}
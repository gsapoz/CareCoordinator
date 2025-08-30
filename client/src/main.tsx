import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import './index.css'
import App from './App.tsx'

// import SchedulePage from "./pages/SchedulePage";
// import ShiftsPage from "./pages/ShiftsPage";
import ProvidersPage from "./pages/ProvidersPage";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // layout shell
    children: [
      { index: true, element: <SchedulePage /> },      // "/"
      { path: "shifts", element: <ShiftsPage /> },     // "/shifts"
      { path: "providers", element: <ProvidersPage /> } // "/providers"
    ],
  },
]);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>
  </StrictMode>,
)

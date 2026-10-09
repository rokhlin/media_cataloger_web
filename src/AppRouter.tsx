import { createBrowserRouter, RouterProvider } from "react-router-dom"
import RootLayout from "./components/layout/RootLayout"
import GalleryPage from "./components/gallery/GalleryPage"
import { FamilyTreeTab } from "./packages/family-tree/components/FamilyTreeTab"
import DuplicatesManagerTab from "./components/duplicates/DuplicatesManagerTab"
import LoginPage from "./components/auth/LoginPage"
import RegisterPage from "./components/auth/RegisterPage"
import OnboardingPage from "./components/auth/OnboardingPage"
import AdminPage from "./components/admin/AdminPage"

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-muted-foreground mt-2">Экран в разработке (V2 Layout)</p>
  </div>
)

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/register",
    element: <RegisterPage />
  },
  {
    path: "/onboarding",
    element: <OnboardingPage />
  },
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <GalleryPage />
      },
      {
        path: "/family-tree",
        element: <FamilyTreeTab />
      },
      {
        path: "/duplicates",
        element: <DuplicatesManagerTab />
      },
      {
        path: "/settings",
        element: <Placeholder title="Настройки" />
      },
      {
        path: "/admin",
        element: <AdminPage />
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}

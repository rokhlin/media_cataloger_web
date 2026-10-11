import { createBrowserRouter, RouterProvider } from "react-router-dom"
import React, { Suspense } from "react"
import RootLayout from "./components/layout/RootLayout"

const GalleryPage = React.lazy(() => import("./components/gallery/GalleryPage"))
const FamilyTreeTab = React.lazy(() => import("./packages/family-tree/components/FamilyTreeTab").then(m => ({ default: m.FamilyTreeTab })))
const DuplicatesManagerTab = React.lazy(() => import("./components/duplicates/DuplicatesManagerTab"))
const LoginPage = React.lazy(() => import("./components/auth/LoginPage"))
const RegisterPage = React.lazy(() => import("./components/auth/RegisterPage"))
const OnboardingPage = React.lazy(() => import("./components/auth/OnboardingPage"))
const AdminPage = React.lazy(() => import("./components/admin/AdminPage"))

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
)
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-muted-foreground mt-2">Экран в разработке (V2 Layout)</p>
  </div>
)

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Suspense fallback={<LoadingFallback />}><LoginPage /></Suspense>
  },
  {
    path: "/register",
    element: <Suspense fallback={<LoadingFallback />}><RegisterPage /></Suspense>
  },
  {
    path: "/onboarding",
    element: <Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense>
  },
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <Suspense fallback={<LoadingFallback />}><GalleryPage /></Suspense>
      },
      {
        path: "/family-tree",
        element: <Suspense fallback={<LoadingFallback />}><FamilyTreeTab /></Suspense>
      },
      {
        path: "/duplicates",
        element: <Suspense fallback={<LoadingFallback />}><DuplicatesManagerTab /></Suspense>
      },
      {
        path: "/settings",
        element: <Placeholder title="Настройки" />
      },
      {
        path: "/admin",
        element: <Suspense fallback={<LoadingFallback />}><AdminPage /></Suspense>
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}

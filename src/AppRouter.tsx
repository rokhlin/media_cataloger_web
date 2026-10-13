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

// V2 Route Screens
const SearchHubScreen = React.lazy(() => import("./components/v2/SearchHubScreen"))
const GeoMapScreen = React.lazy(() => import("./components/v2/GeoMapScreen"))
const PeopleFacesScreen = React.lazy(() => import("./components/v2/PeopleFacesScreen"))
const AlbumsScreen = React.lazy(() => import("./components/v2/AlbumsScreen"))
const FavoritesScreen = React.lazy(() => import("./components/v2/FavoritesScreen"))
const SharedScreen = React.lazy(() => import("./components/v2/SharedScreen"))
const ArchiveScreen = React.lazy(() => import("./components/v2/ArchiveScreen"))
const LockedFolderScreen = React.lazy(() => import("./components/v2/LockedFolderScreen"))
const TrashScreen = React.lazy(() => import("./components/v2/TrashScreen"))
const UserSettingsScreen = React.lazy(() => import("./components/v2/UserSettingsScreen"))

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full py-16">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        path: "/photos",
        element: <Suspense fallback={<LoadingFallback />}><GalleryPage /></Suspense>
      },
      {
        path: "/search",
        element: <Suspense fallback={<LoadingFallback />}><SearchHubScreen /></Suspense>
      },
      {
        path: "/map",
        element: <Suspense fallback={<LoadingFallback />}><GeoMapScreen /></Suspense>
      },
      {
        path: "/people",
        element: <Suspense fallback={<LoadingFallback />}><PeopleFacesScreen /></Suspense>
      },
      {
        path: "/family-tree",
        element: <Suspense fallback={<LoadingFallback />}><FamilyTreeTab /></Suspense>
      },
      {
        path: "/shared",
        element: <Suspense fallback={<LoadingFallback />}><SharedScreen /></Suspense>
      },
      {
        path: "/favorites",
        element: <Suspense fallback={<LoadingFallback />}><FavoritesScreen /></Suspense>
      },
      {
        path: "/albums",
        element: <Suspense fallback={<LoadingFallback />}><AlbumsScreen /></Suspense>
      },
      {
        path: "/albums/:id",
        element: <Suspense fallback={<LoadingFallback />}><AlbumsScreen /></Suspense>
      },
      {
        path: "/duplicates",
        element: <Suspense fallback={<LoadingFallback />}><DuplicatesManagerTab /></Suspense>
      },
      {
        path: "/archive",
        element: <Suspense fallback={<LoadingFallback />}><ArchiveScreen /></Suspense>
      },
      {
        path: "/locked-folder",
        element: <Suspense fallback={<LoadingFallback />}><LockedFolderScreen /></Suspense>
      },
      {
        path: "/trash",
        element: <Suspense fallback={<LoadingFallback />}><TrashScreen /></Suspense>
      },
      {
        path: "/settings",
        element: <Suspense fallback={<LoadingFallback />}><UserSettingsScreen /></Suspense>
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

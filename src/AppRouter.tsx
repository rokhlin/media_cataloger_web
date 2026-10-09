import { createBrowserRouter, RouterProvider } from "react-router-dom"
import RootLayout from "./components/layout/RootLayout"
import GalleryPage from "./components/gallery/GalleryPage"
import { FamilyTreeTab } from "./packages/family-tree/components/FamilyTreeTab"
import DuplicatesManagerTab from "./components/duplicates/DuplicatesManagerTab"

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-muted-foreground mt-2">Экран в разработке (V2 Layout)</p>
  </div>
)

const router = createBrowserRouter([
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
        element: <Placeholder title="Админ панель" />
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}

import { AppLayout } from "@/components/layout/AppLayout";

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

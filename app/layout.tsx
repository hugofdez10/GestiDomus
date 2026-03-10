import "./globals.css"

export const metadata = {
  title: 'GestiDomus OS',
  description: 'Sistema Operativo de Gestión Patrimonial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
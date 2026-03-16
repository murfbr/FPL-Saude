export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/40 print:hidden">
      <div className="container flex h-14 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} FPL Saúde. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

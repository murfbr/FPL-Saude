import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Heart, 
  Move, 
  MapPin, 
  Stethoscope, 
  Clock, 
  CheckCircle2 
} from 'lucide-react'

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FPL Saúde Logo" className="h-10 w-auto object-contain" />
            <span className="font-bold text-xl text-primary tracking-tight hidden sm:inline-block">FPL Saúde</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="outline" className="hidden sm:flex">Área do Cliente</Button>
            </Link>
            <Link to="/login">
              <Button>Agendar Consulta</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="absolute inset-0 bg-grid-slate-200/60 dark:bg-grid-slate-800/60 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,black,rgba(0,0,0,0.6))]" />
          <div className="container relative z-10 px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-4">
                  <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-medium">
                    Fisioterapia Esportiva & Preventiva
                  </div>
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none text-slate-900 dark:text-white">
                    Recuperação e Performance em um só lugar
                  </h1>
                  <p className="max-w-[600px] text-lg text-slate-600 dark:text-slate-300 md:text-xl/relaxed">
                    Especialistas em fisioterapia esportiva, ortopédica e pilates. 
                    Nossa missão é devolver sua qualidade de vida e otimizar seu desempenho físico.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/login">
                    <Button size="lg" className="w-full sm:w-auto text-base">
                      Agendar Agora
                    </Button>
                  </Link>
                  <Link to="#servicos">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                      Conhecer Serviços
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Espaço Novo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Equipamentos Modernos</span>
                  </div>
                </div>
              </div>
              <div className="mx-auto flex w-full max-w-[500px] items-center justify-center lg:max-w-none">
                <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                  {/* Utilizando um gradiente ou imagem genérica como placeholder até ter fotos reais do cloudinary */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/80 to-primary/20 mix-blend-multiply z-10" />
                  <img 
                    src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop" 
                    alt="Clínica de Fisioterapia" 
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="servicos" className="py-20 bg-white dark:bg-slate-950">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-slate-900 dark:text-white">Nossos Serviços</h2>
              <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
                Oferecemos tratamentos completos e personalizados para sua recuperação, prevenção e bem-estar.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Fisioterapia Esportiva", icon: Activity, desc: "Recuperação acelerada e tratamento focado em atletas amadores e profissionais." },
                { title: "Traumato-Ortopédica", icon: Stethoscope, desc: "Tratamento de lesões ósseas, musculares e articulares para alívio da dor." },
                { title: "Pilates", icon: Move, desc: "Fortalecimento, flexibilidade e consciência corporal com equipamentos novos." },
                { title: "Avaliação do Atleta", icon: Heart, desc: "Análise biomecânica para melhorar a performance esportiva com segurança." },
                { title: "Prevenção de Lesões", icon: CheckCircle2, desc: "Protocolos guiados para evitar afastamentos do seu esporte preferido." },
                { title: "Recovery", icon: Clock, desc: "Recuperação muscular pós-treino ou prova utilizando botas compressivas e eletroterapia." }
              ].map((service, i) => (
                <div key={i} className="flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md hover:border-primary/20">
                  <div className="p-3 bg-primary/10 text-primary rounded-full mb-4">
                    <service.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{service.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900">
          <div className="container px-4 md:px-6 relative overflow-hidden">
            <div className="bg-primary rounded-3xl p-8 md:p-12 text-primary-foreground shadow-xl">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Nosso Espaço</h2>
                  <p className="text-primary-foreground/80 md:text-lg">
                    Venha conhecer nosso estúdio recém-inaugurado. Ambiente preparado e equipado para oferecer o melhor tratamento e acompanhamento físico para você.
                  </p>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-6 h-6 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-lg">Flamengo, Rio de Janeiro</p>
                        <p className="text-primary-foreground/80">Rua Barão do Flamengo, 22 - Sala 302</p>
                      </div>
                    </div>
                  </div>
                  <Link to="/login" className="inline-block pt-4">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto font-semibold">
                      Agendar Avaliação
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-4">
                      <img src="https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=500&auto=format&fit=crop" alt="Pilates" className="w-full h-40 object-cover rounded-2xl shadow-md" />
                      <img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=500&auto=format&fit=crop" alt="Recovery" className="w-full h-48 object-cover rounded-2xl shadow-md" />
                   </div>
                   <div className="space-y-4 pt-8">
                      <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&auto=format&fit=crop" alt="Espaço novo" className="w-full h-48 object-cover rounded-2xl shadow-md" />
                      <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&auto=format&fit=crop" alt="Prevenção" className="w-full h-40 object-cover rounded-2xl shadow-md" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-950 py-12">
        <div className="container px-4 md:px-6 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FPL Saúde Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-lg text-primary">FPL Saúde</span>
          </div>
          <p className="text-sm text-slate-500 text-center md:text-left">
            © {new Date().getFullYear()} Fábio Paes Leme - Fisioterapia Esportiva. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a href="https://www.instagram.com/fplsaude/" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary transition-colors">
              Instagram
            </a>
            <a href="#" className="text-slate-500 hover:text-primary transition-colors">
              TikTok
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

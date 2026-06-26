import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  CalendarCheck, 
  FileText, 
  Wallet, 
  Users, 
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Activity,
  Smartphone,
  ArrowRight
} from 'lucide-react'

export default function SaaSLanding() {
  const [activeTab, setActiveTab] = useState('agenda')

  useEffect(() => {
    document.title = 'Clínica Especialista';
    
    // Update Favicon
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = '/favicon_clinica.ico';

    // Try updating OG tags (Note: WhatsApp may still rely on index.html depending on how the site is hosted)
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      ogImage.setAttribute('content', '/logo_clinica_pq.png');
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Clínica Especialista');
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] font-sans selection:bg-teal-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <img src="/logo_clinica_pq.png" alt="Clínica Especialista" className="h-10 w-auto object-contain" />
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
              Clínica Especialista
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400 transition-colors hidden sm:block">
              Acesso Clínicas
            </Link>
            <Link to="#contato">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full px-6 shadow-md hover:shadow-lg transition-all">
                Falar com Especialista
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 md:pt-32 md:pb-40 overflow-hidden">
          {/* Animated Background Mesh */}
          <div className="absolute top-0 inset-x-0 h-full overflow-hidden -z-10 flex justify-center">
            <div className="absolute -top-40 w-[800px] h-[600px] bg-teal-300/30 dark:bg-teal-900/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-lighten animate-pulse duration-10000" />
            <div className="absolute top-20 right-[-20%] w-[600px] h-[600px] bg-blue-300/30 dark:bg-blue-900/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-lighten" />
          </div>

          <div className="container px-4 md:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto space-y-8">
              <div className="inline-flex items-center rounded-full border border-teal-200/50 bg-teal-50/50 px-3 py-1 text-sm text-teal-800 dark:border-teal-800/30 dark:bg-teal-900/20 dark:text-teal-300 font-medium backdrop-blur-sm shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-teal-500 mr-2 animate-pulse"></span>
                A nova era da gestão em saúde
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                Sua clínica, <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-blue-500 to-teal-400">
                  operando no estado da arte.
                </span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                Abandone planilhas e sistemas lentos. O Clínica Especialista reúne agenda inteligente, prontuário, financeiro e portal do paciente em uma interface incrivelmente rápida e intuitiva.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link to="#contato" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-full px-8 h-14 text-lg shadow-[0_0_40px_-10px_rgba(13,148,136,0.5)] transition-all hover:scale-105">
                    Agendar Demonstração <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="#recursos" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full rounded-full px-8 h-14 text-lg border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    Conhecer a Plataforma
                  </Button>
                </Link>
              </div>

              <div className="pt-10 flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-500" /> Implantação Rápida
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-500" /> Multi-Unidades
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-500" /> Conformidade LGPD
                </div>
              </div>
            </div>

            {/* Dashboard Mockup (CSS/HTML Based instead of Image) */}
            <div className="mt-20 relative max-w-5xl mx-auto perspective-1000">
              <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-[#0B1120] via-transparent to-transparent z-20 h-full w-full pointer-events-none" />
              <div className="relative rounded-2xl border border-slate-200/60 dark:border-slate-700/50 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10 transform rotate-x-2 scale-100 origin-bottom transition-transform duration-700 hover:rotate-x-0">
                {/* Mockup Header */}
                <div className="h-12 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center px-4 gap-2 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="mx-auto h-6 w-64 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700/50 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400 font-mono">clinicaespecialista.com.br/app</span>
                  </div>
                </div>
                {/* Mockup Body */}
                <div className="flex h-[400px] md:h-[500px]">
                  {/* Sidebar */}
                  <div className="w-16 md:w-48 border-r border-slate-200/50 dark:border-slate-800/50 p-4 flex flex-col gap-4">
                    <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/50 mb-4" />
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-6 w-full rounded bg-slate-100 dark:bg-slate-800/50 flex items-center px-2">
                        <div className="h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="hidden md:block h-2 w-16 ml-2 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6 flex flex-col gap-6 bg-slate-50/30 dark:bg-slate-900/20">
                    <div className="flex justify-between items-center">
                      <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                      <div className="h-8 w-24 bg-teal-500/20 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between shadow-sm">
                          <div className="h-4 w-8 bg-slate-100 dark:bg-slate-800 rounded" />
                          <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-4">
                      <div className="h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                      <div className="flex-1 flex gap-2">
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className="flex-1 bg-teal-50 dark:bg-teal-900/20 rounded-t-lg mt-auto" style={{ height: `${Math.random() * 80 + 20}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Features Deep Dive */}
        <section id="recursos" className="py-24 relative bg-white dark:bg-[#0B1120]">
          <div className="container px-4 md:px-8">
            <div className="max-w-3xl mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
                Tudo conectado. <br />
                <span className="text-slate-400">Zero retrabalho.</span>
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                A Clínica Especialista foi desenhada para que cada módulo converse entre si de forma perfeita. O que acontece na recepção reflete no financeiro em tempo real.
              </p>
            </div>

            <Tabs defaultValue="agenda" className="flex flex-col lg:flex-row gap-12" onValueChange={setActiveTab}>
              <TabsList className="flex lg:flex-col justify-start h-auto bg-transparent p-0 gap-2 w-full lg:w-1/3 overflow-x-auto lg:overflow-visible">
                {[
                  { id: 'agenda', title: 'Agenda Inteligente', icon: CalendarCheck, desc: 'Gestão visual de salas e profissionais.' },
                  { id: 'prontuario', title: 'Prontuário Eletrônico', icon: FileText, desc: 'Histórico completo e customizável.' },
                  { id: 'financeiro', title: 'Financeiro e Faturamento', icon: Wallet, desc: 'Repasses, caixas e convênios automáticos.' },
                  { id: 'paciente', title: 'Portal do Paciente', icon: Smartphone, desc: 'App white-label para seus pacientes.' },
                ].map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id}
                    className={`w-full justify-start text-left p-6 rounded-2xl transition-all data-[state=active]:bg-teal-50 data-[state=active]:dark:bg-teal-900/20 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-teal-100 data-[state=active]:dark:border-teal-800/50`}
                  >
                    <div className="flex gap-4">
                      <div className={`mt-1 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${activeTab === tab.id ? 'bg-teal-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <tab.icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className={`font-bold text-lg mb-1 ${activeTab === tab.id ? 'text-teal-900 dark:text-teal-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          {tab.title}
                        </h3>
                        <p className={`text-sm hidden sm:block ${activeTab === tab.id ? 'text-teal-700/80 dark:text-teal-300/80' : 'text-slate-500 dark:text-slate-500'}`}>
                          {tab.desc}
                        </p>
                      </div>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="w-full lg:w-2/3">
                {/* Tab Content: Agenda */}
                <TabsContent value="agenda" className="m-0 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Múltiplos profissionais, uma única visão.</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                      Visualize o status da recepção em tempo real. Lembretes automáticos por WhatsApp reduzem faltas em até 40%.
                    </p>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">14:00</div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">Carlos Silva</p>
                            <p className="text-sm text-slate-500">Fisioterapia • Sala 02</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Confirmado</span>
                      </div>
                      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between shadow-sm opacity-60">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold">15:00</div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">Mariana Costa</p>
                            <p className="text-sm text-slate-500">Avaliação • Sala 01</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Aguardando</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Content: Prontuario */}
                <TabsContent value="prontuario" className="m-0 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 h-full">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Evolução clínica sem digitação exaustiva.</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                      Fichas de avaliação customizadas por especialidade. Acesse o histórico anterior do paciente enquanto preenche a evolução atual.
                    </p>
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
                      <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                        <div className="h-2 w-16 bg-teal-500 rounded-full" />
                        <div className="h-2 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        <div className="h-2 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-20 w-full bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800" />
                        </div>
                        <div className="flex gap-4">
                           <div className="h-10 w-24 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-800/50" />
                           <div className="h-10 w-24 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800" />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Content: Financeiro */}
                <TabsContent value="financeiro" className="m-0 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 h-full">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Fluxo de caixa sob controle.</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                      Ao finalizar um atendimento, o sistema já gera as contas a receber e calcula automaticamente o comissionamento do profissional.
                    </p>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                          <p className="text-sm text-slate-500 mb-1">Receita Prevista</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">R$ 12.450</p>
                       </div>
                       <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
                          <p className="text-sm text-slate-500 mb-1">A Pagar</p>
                          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">R$ 3.200</p>
                       </div>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Repasses Pendentes</span>
                        <Button variant="ghost" size="sm" className="h-8 text-teal-600">Ver Todos</Button>
                      </div>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                           <span className="text-slate-600 dark:text-slate-400">Dr. Roberto (Fisio)</span>
                           <span className="font-medium text-slate-900 dark:text-white">R$ 1.850,00</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-600 dark:text-slate-400">Dra. Amanda (Pilates)</span>
                           <span className="font-medium text-slate-900 dark:text-white">R$ 2.100,00</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Content: Paciente */}
                <TabsContent value="paciente" className="m-0 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 h-full flex flex-col items-center justify-center text-center">
                    <div className="relative mb-8">
                       <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full" />
                       <Smartphone className="h-24 w-24 text-slate-800 dark:text-slate-200 relative z-10" strokeWidth={1} />
                       <div className="absolute top-0 right-0 h-6 w-6 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 z-20 flex items-center justify-center text-[10px] text-white font-bold">1</div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">A clínica no bolso do seu paciente.</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-lg max-w-md mx-auto">
                      Seus pacientes acessam um portal com as cores da sua clínica para reagendar consultas, baixar recibos e conferir prescrições de forma autônoma.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </section>

        {/* Analytics / Scale Section */}
        <section className="py-24 bg-teal-600 dark:bg-teal-900 relative overflow-hidden text-white">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <div className="container px-4 md:px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                  Gestão baseada em dados reais.
                </h2>
                <p className="text-teal-100 text-lg mb-8">
                  Descubra quais convênios são mais lucrativos, qual a taxa de evasão de pacientes e projete seu faturamento futuro com dashboards executivos integrados.
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-4xl font-extrabold mb-1">99.9%</div>
                    <div className="text-teal-200 text-sm font-medium uppercase tracking-wider">Uptime Garantido</div>
                  </div>
                  <div>
                    <div className="text-4xl font-extrabold mb-1">ISO</div>
                    <div className="text-teal-200 text-sm font-medium uppercase tracking-wider">Segurança Padrão</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-md border border-white/20">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-white/20 rounded-xl"><Activity className="w-6 h-6 text-white" /></div>
                  <h3 className="font-semibold text-xl">Taxa de Ocupação</h3>
                </div>
                <div className="flex items-end gap-2 h-40">
                  {[40, 55, 45, 70, 85, 75, 95].map((h, i) => (
                    <div key={i} className="flex-1 bg-white/30 rounded-t-lg transition-all hover:bg-white/50 cursor-pointer relative group" style={{ height: `${h}%` }}>
                       <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                         {h}%
                       </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-teal-200 text-sm">
                  <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="contato" className="py-32 bg-[#F8FAFC] dark:bg-[#0B1120]">
          <div className="container px-4 md:px-8">
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[2.5rem] p-10 md:p-20 text-white text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-teal-500/30 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <img src="/logo_clinica_pq.png" alt="Clínica Especialista" className="h-20 w-auto mx-auto mb-8" />
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                  Leve sua clínica para o próximo nível.
                </h2>
                <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                  Agende uma demonstração personalizada. Sem compromisso, sem cartão de crédito exigido. Descubra como economizar horas de trabalho toda semana.
                </p>
                <a href="mailto:contato@clinicaespecialista.com.br" className="inline-block">
                  <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-lg px-10 h-16 rounded-full shadow-[0_0_30px_-5px_rgba(45,212,191,0.4)] transition-transform hover:scale-105">
                    Falar com Especialista
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] py-12">
        <div className="container px-4 md:px-8 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo_clinica_pq.png" alt="Logo" className="h-6 w-auto object-contain grayscale opacity-70" />
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Clínica Especialista</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-left">
            © {new Date().getFullYear()} Clínica Especialista SaaS. Feito para os melhores gestores em saúde.
          </p>
          <div className="flex gap-6">
            <Link to="/privacidade" className="text-sm font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 transition-colors">
              Privacidade
            </Link>
            <Link to="/termos" className="text-sm font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 transition-colors">
              Termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

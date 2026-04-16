import { useState, useRef, useEffect } from 'react'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface BeforeAfterSliderProps {
  beforeUrl?: string
  afterUrl?: string
  className?: string
}

export function BeforeAfterSlider({ beforeUrl, afterUrl, className = '' }: BeforeAfterSliderProps) {
  const [sliderValue, setSliderValue] = useState(50)
  const [activeTab, setActiveTab] = useState<'slider' | 'side-by-side'>('side-by-side')
  const [isLoadingImages, setIsLoadingImages] = useState({ before: true, after: true })

  // Se não tem uma ou outra, mostra um fallback ou apenas a que tem
  const hasBoth = !!(beforeUrl && afterUrl)

  const handleImageLoad = (type: 'before' | 'after') => {
    setIsLoadingImages(prev => ({ ...prev, [type]: false }))
  }

  if (!beforeUrl && !afterUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-md text-muted-foreground">
        <ImageOff className="w-12 h-12 mb-2 opacity-50" />
        <p>Nenhuma imagem disponível.</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col space-y-4 w-full ${className}`}>
      {hasBoth && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full h-full">
          <div className="flex justify-center mb-4">
            <TabsList>
              <TabsTrigger value="slider">Comparar (Slider)</TabsTrigger>
              <TabsTrigger value="side-by-side">Lado a Lado</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="slider" className="mt-0">
            <div className="relative w-full aspect-square md:aspect-[4/3] rounded-md overflow-hidden bg-muted group select-none">
              {/* Imagem de Fundo (ANTES) */}
              <img
                src={beforeUrl}
                alt="Antes"
                className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                onLoad={() => handleImageLoad('before')}
              />
              {isLoadingImages.before && <Skeleton className="absolute inset-0 z-10" />}
              
              <div className="absolute top-4 left-4 z-40 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold shadow-sm">
                ANTES
              </div>

              {/* Usando clip-path para revelar limpo o antes e depois */}
              <div 
                className="absolute top-0 left-0 w-full h-full z-30"
                style={{ clipPath: `inset(0 0 0 ${sliderValue}%)` }}
              >
                <img
                  src={afterUrl}
                  alt="Depois"
                  className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                  onLoad={() => handleImageLoad('after')}
                />
                
                <div className="absolute top-4 right-4 z-40 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold shadow-sm">
                  DEPOIS
                </div>
              </div>
              
              {isLoadingImages.after && <Skeleton className="absolute inset-0 z-30" />}

              {/* SLIDER CONTROL */}
              <div className="absolute top-0 bottom-0 z-50 w-full pointer-events-none flex items-center justify-center">
                <Slider
                  defaultValue={[50]}
                  max={100}
                  step={0.1}
                  value={[sliderValue]}
                  onValueChange={(vals) => setSliderValue(vals[0])}
                  className="w-[calc(100%+20px)] mx-[-10px] pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  // Using custom CSS classes in standard Tailwind could be tricky for the thumb, 
                  // but Radix Slider thumb is large enough to drag.
                />
                {/* Visual Line */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white/70 shadow-[0_0_5px_rgba(0,0,0,0.5)] cursor-ew-resize pointer-events-auto"
                  style={{ left: `calc(${sliderValue}%)`, transform: 'translateX(-50%)' }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow border flex items-center justify-center">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-600">
                      <path d="M5.5 3L2 7.5L5.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.5 3L13 7.5L9.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="side-by-side">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative w-full aspect-square rounded-md overflow-hidden bg-muted">
                <img src={beforeUrl} alt="Antes" className="w-full h-full object-contain" />
                <div className="absolute top-4 left-4 bg-background/80 px-2 py-1 rounded text-xs font-semibold">ANTES</div>
              </div>
              <div className="relative w-full aspect-square rounded-md overflow-hidden bg-muted">
                <img src={afterUrl} alt="Depois" className="w-full h-full object-contain" />
                <div className="absolute top-4 right-4 bg-background/80 px-2 py-1 rounded text-xs font-semibold">DEPOIS</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!hasBoth && beforeUrl && !afterUrl && (
        <div className="relative w-full max-w-2xl mx-auto aspect-square md:aspect-video rounded-md overflow-hidden bg-muted">
          <img src={beforeUrl} alt="Antes" className="w-full h-full object-contain" />
          <div className="absolute top-4 left-4 bg-background/80 px-2 py-1 rounded text-xs font-semibold shadow">FOTO ÚNICA (ANTES)</div>
        </div>
      )}

      {!hasBoth && !beforeUrl && afterUrl && (
        <div className="relative w-full max-w-2xl mx-auto aspect-square md:aspect-video rounded-md overflow-hidden bg-muted">
          <img src={afterUrl} alt="Depois" className="w-full h-full object-contain" />
          <div className="absolute top-4 right-4 bg-background/80 px-2 py-1 rounded text-xs font-semibold shadow">FOTO ÚNICA (DEPOIS)</div>
        </div>
      )}
    </div>
  )
}

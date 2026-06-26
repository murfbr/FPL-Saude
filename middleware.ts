export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _vercel (Vercel internals)
    // - files with an extension (e.g. .js, .css, .png, .ico, .svg)
    '/((?!api|_vercel|.*\\..*).*)',
    '/',
  ],
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const hostname = request.headers.get('host') || '';

  // Only apply modifications for the Clínica Especialista domain
  // We check for both production and potential staging domains
  if (!hostname.includes('clinicaespecialista')) {
    // Proceed normally for FPL and other domains
    return;
  }

  try {
    // Fetch the original index.html
    // Since index.html has a dot (.), it bypasses this middleware because of the matcher config
    const targetUrl = `${url.origin}/index.html`;
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return;
    }

    let html = await response.text();

    // Replace FPL tags with Clínica Especialista tags for Open Graph and SEO
    html = html.replace('<title>FPL Saúde</title>', '<title>Clínica Especialista</title>');
    html = html.replace(
      'content="FPL Saúde - Fisioterapia Esportiva"', 
      'content="Clínica Especialista - O estado da arte em gestão de clínicas"'
    );
    html = html.replace('content="/og-image.jpeg"', 'content="/logo_clinica_pq.png"');
    html = html.replace(
      'content="FPL-Saúde, Fisioterapia, Recuperação, Gestão"', 
      'content="Clínica, Gestão, Fisioterapia, Saúde, SaaS"'
    );
    html = html.replace('content="FPL Saúde"', 'content="Clínica Especialista"');
    html = html.replace(
      'content="Plataforma de Gestão FPL Saúde"', 
      'content="Plataforma de Gestão Clínica Especialista"'
    );

    // Return the modified HTML
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    // If fetching fails, let the request proceed normally
    console.error('Middleware Error:', error);
    return;
  }
}

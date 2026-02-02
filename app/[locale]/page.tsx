import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-amber-900 mb-6">
          Votre cave à whisky digitale
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          Scannez, cataloguez et partagez votre collection de whiskies. 
          Découvrez des milliers de bouteilles et connectez-vous avec des passionnés.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-bold mb-2">Scan & Add</h3>
            <p className="text-gray-600">Scannez l'étiquette pour ajouter instantanément une bouteille à votre collection</p>
          </div>
          
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">Analytics</h3>
            <p className="text-gray-600">Visualisez vos statistiques : régions, prix, âge moyen de votre collection</p>
          </div>
          
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">Explorer</h3>
            <p className="text-gray-600">Découvrez des milliers de whiskies, filtrez par région, prix, type</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-x-4">
          <Link 
            href="/explorer" 
            className="inline-block px-8 py-3 bg-amber-900 text-white rounded-lg hover:bg-amber-800 text-lg"
          >
            Explorer le catalogue
          </Link>
          <Link 
            href="/register" 
            className="inline-block px-8 py-3 border-2 border-amber-900 text-amber-900 rounded-lg hover:bg-amber-50 text-lg"
          >
            Créer un compte gratuit
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 p-6 text-center text-gray-500 border-t">
        <p>© 2024 DramNotes - Votre passion, notre technologie</p>
      </footer>
    </div>
  )
}
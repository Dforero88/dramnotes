import Link from 'next/link'

export default function AuthBlock({ 
  title = "Accès réservé",
  message = "Connectez-vous pour accéder à cette fonctionnalité"
}: {
  title?: string
  message?: string
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-bold text-amber-900 mb-4">{title}</h2>
        <p className="text-gray-600 mb-8">{message}</p>
        
        <div className="space-y-4">
          <Link 
            href="/login" 
            className="block w-full py-3 bg-amber-900 text-white rounded-lg hover:bg-amber-800"
          >
            Se connecter
          </Link>
          <Link 
            href="/register" 
            className="block w-full py-3 border-2 border-amber-900 text-amber-900 rounded-lg hover:bg-amber-50"
          >
            Créer un compte
          </Link>
        </div>
        
        <p className="mt-8 text-sm text-gray-500">
          Déjà un passionné de whisky ? Rejoignez notre communauté !
        </p>
      </div>
    </div>
  )
}
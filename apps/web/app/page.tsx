import { redirect } from 'next/navigation'

// Root redirects to the sports tab (main landing)
export default function RootPage() {
  redirect('/(main)/sports')
}

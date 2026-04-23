import { useAuth } from '@clerk/clerk-react'
import { useCallback, useState } from 'react'
import { calcular as apiCalcular, getListings } from '../services/api'

export function useCalculadora() {
  const { getToken } = useAuth()
  const [listings, setListings] = useState([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [loadingCalculo, setLoadingCalculo] = useState(false)
  const [erro, setErro] = useState(null)

  const fetchListings = useCallback(async () => {
    setLoadingListings(true)
    setErro(null)
    try {
      const data = await getListings(getToken)
      setListings(data)
    } catch (e) {
      setErro('Erro ao carregar imóveis: ' + e.message)
    } finally {
      setLoadingListings(false)
    }
  }, [getToken])

  const calcular = useCallback(async (payload) => {
    setLoadingCalculo(true)
    setErro(null)
    try {
      const data = await apiCalcular(payload, getToken)
      setResultado(data)
    } catch (e) {
      setErro('Erro ao calcular: ' + e.message)
    } finally {
      setLoadingCalculo(false)
    }
  }, [getToken])

  return { listings, loadingListings, resultado, loadingCalculo, erro, fetchListings, calcular }
}

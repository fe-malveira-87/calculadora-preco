---
variavel: demanda_score
tipo: lookup
prioridade: 3
ativo: true
---

# Regras de Demanda (PriceLabs)

Descontos baseados no índice de demanda de busca para o imóvel/região.
Limites em ordem crescente; o primeiro `limite >= score` determina o desconto.

| Score máximo de demanda | Desconto máximo |
|-------------------------|-----------------|
| 20  | 15% |
| 39  | 10% |
| 70  | 5%  |
| 100 | 0%  |

## Observações

- O índice de demanda vem do campo `demand_score` da API PriceLabs
- Considerar o período selecionado, não o dia atual

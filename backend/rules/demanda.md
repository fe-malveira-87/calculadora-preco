# Regras de Demanda (PriceLabs)

Descontos baseados no índice de demanda de busca para o imóvel/região.

## Regras

| Nível de demanda | Desconto máximo permitido |
|-----------------|--------------------------|
| Alta (>70%) | 0% (sem desconto) |
| Média (40% a 70%) | 5% |
| Baixa (20% a 39%) | 10% |
| Muito baixa (<20%) | 15% |

## Observações

- O índice de demanda vem do campo `demand_score` da API PriceLabs
- Considerar o período selecionado, não o dia atual

# Regras Combinadas

Regras que cruzam múltiplos fatores para ajustar o desconto final.

## Regras

| Condição | Ajuste |
|----------|--------|
| Demanda baixa + disponibilidade alta (>21 dias) | Desconto máximo das duas regras individuais |
| Demanda alta + disponibilidade alta | Desconto limitado a 5% |
| Preço atual < preço mínimo PriceLabs | Nenhum desconto (manter ou aumentar preço) |
| Preço atual > preço médio PriceLabs * 1.2 | Desconto de até 10% para aproximar da média |

## Prioridade de aplicação

1. Regra de repasse (proteção máxima)
2. Regras combinadas
3. Regras de demanda
4. Regras de disponibilidade

O desconto final é sempre o **menor** valor entre as regras aplicáveis.

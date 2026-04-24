---
variavel: dias_disponiveis
tipo: lookup
prioridade: 4
ativo: true
---

# Regras de Disponibilidade

Descontos baseados em quantos dias o imóvel está disponível sem reserva no período analisado.

| Limite de noites livres | Desconto máximo |
|-------------------------|-----------------|
| 7   | 0%  |
| 14  | 5%  |
| 21  | 10% |
| 30  | 15% |
| 999 | 20% |

## Observações

- Contar apenas dias futuros (a partir de hoje)
- Feriados e alta temporada reduzem o desconto permitido em 50%

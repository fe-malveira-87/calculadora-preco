---
variavel: diaria_atual
tipo: lookup
prioridade: 2
ativo: true
---

# Política de Temporada

Descontos baseados no valor da diária atual. Diárias altas indicam alta temporada
e não devem receber grandes descontos.

| Limite de diária (R$) | Desconto máximo |
|-----------------------|-----------------|
| 200  | 15% |
| 400  | 10% |
| 600  | 5%  |
| 9999 | 0%  |

## Observações

- Diárias acima de R$600 estão em alta temporada — desconto zero
- Ajustar os limites conforme a média do portfólio

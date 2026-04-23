import streamlit as st
import pandas as pd
from datetime import date, timedelta

from clients.hostaway import HostawayClient
from clients.pricelabs import PriceLabsClient
from calculator import CalculadoraDesconto, DadosImovel, DadosPriceLabs

st.set_page_config(
    page_title="Calculadora de Descontos — WeCare",
    page_icon="🏡",
    layout="wide",
)

st.title("Calculadora de Descontos")
st.caption("WeCare Hosting · dados via Hostaway + PriceLabs")

# ---------------------------------------------------------------------------
# Clientes e cache
# ---------------------------------------------------------------------------

@st.cache_resource
def get_clients():
    return HostawayClient(), PriceLabsClient()


@st.cache_data(ttl=300)
def carregar_imoveis_hostaway():
    hw, _ = get_clients()
    return hw.get_listings()


@st.cache_data(ttl=300)
def carregar_imoveis_pricelabs():
    _, pl = get_clients()
    return pl.get_listings()


# ---------------------------------------------------------------------------
# Sidebar — seleção de imóvel e período
# ---------------------------------------------------------------------------

with st.sidebar:
    st.header("Configurações")

    with st.spinner("Carregando imóveis..."):
        try:
            imoveis = carregar_imoveis_hostaway()
        except Exception as e:
            st.error(f"Erro ao conectar ao Hostaway: {e}")
            st.stop()

    opcoes = {f"{i.get('name', 'Sem nome')} (#{i['id']})": i for i in imoveis}
    selecionado_label = st.selectbox("Imóvel", list(opcoes.keys()))
    imovel_hw = opcoes[selecionado_label]
    listing_id_hw = imovel_hw["id"]

    st.divider()

    hoje = date.today()
    data_inicio = st.date_input("Data início", value=hoje, min_value=hoje)
    data_fim = st.date_input(
        "Data fim",
        value=hoje + timedelta(days=30),
        min_value=data_inicio + timedelta(days=1),
    )

    st.divider()

    diaria_atual = st.number_input(
        "Diária atual (R$)",
        min_value=0.0,
        value=float(imovel_hw.get("price", 0)),
        step=10.0,
        format="%.2f",
    )

    repasse_minimo = st.number_input(
        "Repasse mínimo ao proprietário (R$)",
        min_value=0.0,
        value=0.0,
        step=10.0,
        format="%.2f",
        help="Valor mínimo garantido ao proprietário por diária",
    )

    calcular = st.button("Calcular desconto", type="primary", use_container_width=True)

# ---------------------------------------------------------------------------
# Área principal
# ---------------------------------------------------------------------------

if not calcular:
    st.info("Configure o imóvel e o período na barra lateral e clique em **Calcular desconto**.")
    st.stop()

with st.spinner("Buscando dados..."):
    hw_client, pl_client = get_clients()

    # --- Hostaway ---
    try:
        dias_disponiveis = hw_client.count_available_days(listing_id_hw, data_inicio, data_fim)
        taxas = hw_client.get_listing_fees(listing_id_hw)
        reservas = hw_client.get_reservations(listing_id_hw, data_inicio, data_fim)
    except Exception as e:
        st.error(f"Erro ao buscar dados do Hostaway: {e}")
        st.stop()

    # --- PriceLabs ---
    try:
        imoveis_pl = carregar_imoveis_pricelabs()
        # tenta encontrar o id PriceLabs pelo nome do imóvel
        listing_id_pl = next(
            (str(i.get("id", i.get("listing_id")))
             for i in imoveis_pl
             if i.get("name", "").strip().lower() == imovel_hw.get("name", "").strip().lower()),
            None,
        )

        if listing_id_pl:
            resumo_pl = pl_client.get_price_summary(listing_id_pl, data_inicio, data_fim)
            demanda = resumo_pl.get("demanda_media", 0)
            preco_minimo_pl = resumo_pl.get("preco_minimo", 0)
            preco_medio_pl = resumo_pl.get("preco_medio", 0)
            preco_maximo_pl = resumo_pl.get("preco_maximo", 0)
        else:
            st.warning("Imóvel não encontrado no PriceLabs pelo nome. Usando demanda = 0.")
            demanda = 0.0
            preco_minimo_pl = preco_medio_pl = preco_maximo_pl = 0.0

    except Exception as e:
        st.warning(f"Erro ao buscar dados do PriceLabs: {e}. Demanda será 0.")
        demanda = 0.0
        preco_minimo_pl = preco_medio_pl = preco_maximo_pl = 0.0

# --- Montar objetos do calculator ---
dados_imovel = DadosImovel(
    listing_id=str(listing_id_hw),
    nome=imovel_hw.get("name", ""),
    diaria_atual=diaria_atual,
    cleaning_fee=taxas.get("cleaning_fee", 0),
    channel_fee_percent=taxas.get("channel_fee_percent", 0),
    dias_disponiveis=dias_disponiveis,
    repasse_proprietario=diaria_atual * 0.7,  # estimativa padrão 70% — ajustar por imóvel
    repasse_minimo=repasse_minimo,
)

dados_pl = DadosPriceLabs(
    preco_minimo=preco_minimo_pl,
    preco_medio=preco_medio_pl,
    preco_maximo=preco_maximo_pl,
    demanda_media=demanda,
)

resultado = CalculadoraDesconto().calcular(dados_imovel, dados_pl)

# ---------------------------------------------------------------------------
# Cards principais
# ---------------------------------------------------------------------------

st.subheader(f"{imovel_hw.get('name', '')} · {data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')}")
st.divider()

col1, col2, col3, col4 = st.columns(4)

col1.metric(
    "Diária atual",
    f"R$ {diaria_atual:,.2f}",
)
col2.metric(
    "Desconto sugerido",
    f"{resultado.desconto_percentual:.1f}%",
    delta=f"-R$ {diaria_atual - resultado.preco_sugerido:,.2f}",
    delta_color="inverse",
)
col3.metric(
    "Preco sugerido",
    f"R$ {resultado.preco_sugerido:,.2f}",
)
col4.metric(
    "Repasse resultante",
    f"R$ {resultado.repasse_resultante:,.2f}",
    delta=f"mín R$ {repasse_minimo:,.2f}",
    delta_color="off",
)

# ---------------------------------------------------------------------------
# Alertas
# ---------------------------------------------------------------------------

if resultado.alertas:
    for alerta in resultado.alertas:
        st.error(alerta)

# ---------------------------------------------------------------------------
# Dados das fontes
# ---------------------------------------------------------------------------

st.divider()
col_hw, col_pl = st.columns(2)

with col_hw:
    st.subheader("Hostaway")
    st.metric("Dias disponíveis no período", dias_disponiveis)
    st.metric("Taxa de limpeza", f"R$ {taxas.get('cleaning_fee', 0):,.2f}")
    st.metric("Comissão do canal", f"{taxas.get('channel_fee_percent', 0):.1f}%")

    if reservas:
        st.markdown("**Reservas no período**")
        df_res = pd.DataFrame([
            {
                "Check-in": r.get("arrivalDate", ""),
                "Check-out": r.get("departureDate", ""),
                "Hóspede": r.get("guestName", ""),
                "Canal": r.get("channelName", ""),
                "Total": f"R$ {r.get('totalPrice', 0):,.2f}",
            }
            for r in reservas
        ])
        st.dataframe(df_res, use_container_width=True, hide_index=True)
    else:
        st.info("Nenhuma reserva no período.")

with col_pl:
    st.subheader("PriceLabs")
    demanda_label = (
        "Alta" if demanda > 70
        else "Média" if demanda >= 40
        else "Baixa" if demanda >= 20
        else "Muito baixa"
    )
    st.metric("Demanda média", f"{demanda:.0f}% · {demanda_label}")
    st.metric("Preço mínimo sugerido", f"R$ {preco_minimo_pl:,.2f}")
    st.metric("Preço médio sugerido", f"R$ {preco_medio_pl:,.2f}")
    st.metric("Preço máximo sugerido", f"R$ {preco_maximo_pl:,.2f}")

# ---------------------------------------------------------------------------
# Regras aplicadas
# ---------------------------------------------------------------------------

st.divider()
with st.expander("Regras aplicadas", expanded=False):
    for regra in resultado.regras_aplicadas:
        st.markdown(f"- {regra}")

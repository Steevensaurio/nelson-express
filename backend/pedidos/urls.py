from django.urls import path
from .views import DespachoPedidoListView, DespachoMotorizadoListView, DespachoAsignarView, CotizarEncargoView, EncargoCreateView, DespachoEncargoCreateView, DespachoGananciasView, CotizarEnvioView, DespachoCancelarView, PedidoListCreateView, PedidoDetailView, PerfilView, NegocioListView, ProductoListView, MisEntregasView, MiEntregaDetailView, ActualizarEstadoPedidoView, DireccionListCreateView, DireccionDetailView

urlpatterns = [
    path('perfil/', PerfilView.as_view()),
    path('despacho/pedidos/', DespachoPedidoListView.as_view()),
    path('despacho/pedidos/<int:pk>/asignar/', DespachoAsignarView.as_view()),
    path('despacho/pedidos/<int:pk>/cancelar/', DespachoCancelarView.as_view()),
    path('despacho/ganancias/', DespachoGananciasView.as_view()),
    path('despacho/motorizados/', DespachoMotorizadoListView.as_view()),
    path('pedidos/cotizar/', CotizarEnvioView.as_view()),
    path('encargos/', EncargoCreateView.as_view()),
    path('encargos/cotizar/', CotizarEncargoView.as_view()),
    path('despacho/encargos/', DespachoEncargoCreateView.as_view()),
    path('pedidos/', PedidoListCreateView.as_view()),
    path('pedidos/<int:pk>/', PedidoDetailView.as_view()),
    path('negocios/', NegocioListView.as_view()),
    path('negocios/<int:negocio_id>/productos/', ProductoListView.as_view()),
    path('mis-entregas/', MisEntregasView.as_view()),
    path('mis-entregas/<int:pk>/', MiEntregaDetailView.as_view()),
    path('pedidos/<int:pk>/estado/', ActualizarEstadoPedidoView.as_view()),
    path('direcciones/', DireccionListCreateView.as_view()),
    path('direcciones/<int:pk>/', DireccionDetailView.as_view()),
    
    
]

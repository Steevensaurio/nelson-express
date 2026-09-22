from rest_framework.permissions import BasePermission

from .models import Usuario


class EsDespachador(BasePermission):
    message = 'Solo los despachadores pueden acceder a este recurso.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.rol == Usuario.Rol.ADMIN)

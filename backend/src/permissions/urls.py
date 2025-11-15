from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PermissionViewSet,
    UserRoleViewSet,
    ObjectPermissionViewSet,
    ModelPermissionConfigViewSet,
    ContentTypeViewSet,
    PermissionManagerViewSet
)

router = DefaultRouter()
router.register(r'permissions', PermissionViewSet)
router.register(r'roles', UserRoleViewSet)
router.register(r'object-permissions', ObjectPermissionViewSet)
router.register(r'model-configs', ModelPermissionConfigViewSet)
router.register(r'content-types', ContentTypeViewSet)
router.register(r'permission-manager', PermissionManagerViewSet, basename='permission-manager')

urlpatterns = [
    path('', include(router.urls)),
]
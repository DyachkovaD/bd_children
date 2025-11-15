from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User
from .models import Permission, ObjectPermission, UserRole, ModelPermissionConfig
from .serializers import (
    PermissionSerializer,
    UserRoleSerializer,
    ObjectPermissionSerializer,
    GrantObjectPermissionSerializer,
    ModelPermissionConfigSerializer,
    UserPermissionsSerializer,
    ContentTypeSerializer
)
from .permissions import IsAdminOrReadOnly
from .utils import get_user_permissions, initialize_all_models

class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all().select_related('content_type')
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        model_name = self.request.query_params.get('model')
        if model_name:
            try:
                content_type = ContentType.objects.get(model=model_name)
                queryset = queryset.filter(content_type=content_type)
            except ContentType.DoesNotExist:
                pass
        return queryset


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all().prefetch_related('permissions', 'users')
    serializer_class = UserRoleSerializer
    permission_classes = [IsAdminOrReadOnly]


class ObjectPermissionViewSet(viewsets.ModelViewSet):
    queryset = ObjectPermission.objects.all().select_related('user', 'permission', 'content_type')
    serializer_class = ObjectPermissionSerializer
    permission_classes = [IsAdminOrReadOnly]


class ModelPermissionConfigViewSet(viewsets.ModelViewSet):
    queryset = ModelPermissionConfig.objects.all().select_related('content_type')
    serializer_class = ModelPermissionConfigSerializer
    permission_classes = [IsAdminOrReadOnly]


class ContentTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ContentType.objects.all()
    serializer_class = ContentTypeSerializer
    permission_classes = [IsAdminOrReadOnly]


class PermissionManagerViewSet(viewsets.ViewSet):
    """ViewSet для управления разрешениями"""
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=False, methods=['post'])
    def grant_object_permission(self, request):
        serializer = GrantObjectPermissionSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data

            # Создаем или получаем разрешение на объект
            obj_perm, created = ObjectPermission.objects.get_or_create(
                user=data['user'],
                permission=data['permission'],
                content_type=data['content_type'],
                object_id=data['object_id'],
                defaults={'granted_by': request.user}
            )

            if created:
                return Response(
                    {'status': 'Разрешение выдано'},
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {'status': 'Разрешение уже существует'},
                    status=status.HTTP_200_OK
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def revoke_object_permission(self, request):
        serializer = GrantObjectPermissionSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data

            deleted, _ = ObjectPermission.objects.filter(
                user=data['user'],
                permission=data['permission'],
                content_type=data['content_type'],
                object_id=data['object_id']
            ).delete()

            if deleted:
                return Response({'status': 'Разрешение отозвано'})
            else:
                return Response(
                    {'error': 'Разрешение не найдено'},
                    status=status.HTTP_404_NOT_FOUND
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_user_permissions(self, request):
        user_id = request.query_params.get('user_id')
        model_name = request.query_params.get('model_name')

        if not user_id:
            return Response(
                {'error': 'user_id обязателен'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=user_id)
            model_class = None

            if model_name:
                content_type = ContentType.objects.get(model=model_name)
                model_class = content_type.model_class()

            permissions = get_user_permissions(user, model_class)

            return Response({
                'user_id': user.id,
                'username': user.username,
                'model': model_name,
                'permissions': list(permissions)
            })

        except User.DoesNotExist:
            return Response(
                {'error': 'Пользователь не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ContentType.DoesNotExist:
            return Response(
                {'error': 'Модель не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def initialize_models(self, request):
        """Инициализирует разрешения для всех моделей"""
        try:
            managed_models = initialize_all_models()
            return Response({
                'status': 'Модели инициализированы',
                'managed_models': managed_models
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
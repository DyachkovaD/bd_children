from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, logout
from django.contrib.auth.models import User

from .serializers import UserRegistrationSerializer, UserSerializer


class RegisterView(APIView):
    """ API endpoint для регистрации пользователя."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    API для авторизации пользователя
    POST api/login/
    {"username": "test", "password": "test"}
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)

        if user:
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)

        return Response({
            'error': 'Неверные имя пользователя или пароль'
        }, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(APIView):
    """API для просмотра данных пользователя"""
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    API для выхода пользователя из системы.
    """
    try:
        logout(request.user)
        return Response({'message': 'Успешный выход из системы'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': 'Ошибка выхода'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    """API для получения списка пользователей"""
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

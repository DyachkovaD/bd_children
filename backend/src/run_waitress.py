"""
Запуск приложения через Waitress (для деплоя на Windows).
Использование: из папки backend/src выполнить
  python run_waitress.py
или
  waitress-serve --host=0.0.0.0 --port=8000 src.wsgi:application
"""
import os
import sys

# Корень проекта — папка, где лежит manage.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'src.settings')

from waitress import serve
from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    host = os.environ.get('HOST', '0.0.0.0')
    print(f'Сервер: http://{host}:{port}')
    serve(application, host=host, port=port)

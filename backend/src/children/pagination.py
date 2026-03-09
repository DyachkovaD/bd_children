from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class DataPageNumberPagination(PageNumberPagination):
    """
    Пагинация с обёрткой данных в атрибут "data" и подсчётом количества.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'data': data
        })

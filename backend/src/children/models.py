from django.db import models

# Create your models here.

class Child(models.Model):
    """Модель учащегося"""
    first_name = models.CharField("Имя", max_length=50)
    last_name = models.CharField("Фамилия", max_length=50)
    patronymic = models.CharField("Отчество", max_length=50)
    address =  models.CharField("Адрес", max_length=100)
    health_status =  models.CharField("Состояние здоровья", max_length=100)
    family_status =  models.CharField("Статус семьи", max_length=100)
    note = models.CharField("Примечание", max_length=500)

    education_class = models.IntegerField("Номер класса")

    birthday = models.DateTimeField("Дата рождения")

    school =  models.ForeignKey('children.School', on_delete=models.PROTECT)


class School(models.Model):
    """Модель учащегося"""
    full_name = models.CharField("Полное название", max_length=100)
    short_name = models.CharField("Краткое название", max_length=100)
    director = models.CharField("Имя директора", max_length=100)
    address = models.CharField("Адрес", max_length=100)


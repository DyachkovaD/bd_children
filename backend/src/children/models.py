from django.db import models

# Create your models here.

class Child(models.Model):
    """Модель учащегося"""
    first_name = models.CharField("Имя", max_length=50)
    last_name = models.CharField("Фамилия", max_length=50)
    patronymic = models.CharField("Отчество", max_length=50, null=True, blank=True)
    address =  models.CharField("Адрес", max_length=100, null=True, blank=True)
    health_status =  models.CharField("Состояние здоровья", max_length=100, null=True, blank=True)
    family_status =  models.CharField("Статус семьи", max_length=100, null=True, blank=True)
    note = models.CharField("Примечание", max_length=500, null=True, blank=True)

    education_class = models.IntegerField("Номер класса")

    birthday = models.DateTimeField("Дата рождения")

    school =  models.ForeignKey('children.School', on_delete=models.PROTECT)

    class Meta:
        verbose_name = "Учащийся"
        verbose_name_plural = "Учащиеся"
        ordering = ["last_name"]


class School(models.Model):
    """Модель учащегося"""
    full_name = models.CharField("Полное название", max_length=100)
    short_name = models.CharField("Краткое название", max_length=100)
    director = models.CharField("Имя директора", max_length=100, null=True, blank=True)
    address = models.CharField("Адрес", max_length=100, null=True, blank=True)

    class Meta:
        verbose_name = "Школа"
        verbose_name_plural = "Школы"
        ordering = ["full_name"]


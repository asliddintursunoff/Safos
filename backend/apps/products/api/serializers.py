from rest_framework import serializers
from apps.products.models import Product,ProductCategory
from apps.common.images import media_url




class ProductSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=ProductCategory.objects.all())
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price','unit','unit_display','value','picture', 'category']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["picture"] = media_url(instance.picture)
        return data


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'name']
        
class ProductCategoryReadSerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    class Meta:
        model = ProductCategory
        fields = ['id', 'name','products']
        



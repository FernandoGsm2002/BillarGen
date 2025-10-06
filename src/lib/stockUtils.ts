import { supabase } from './supabaseClient';

/**
 * Registra un cambio en el stock de un producto
 * Esta función debe llamarse cada vez que se modifica el stock de un producto
 */
export async function recordStockChange({
  tenantId,
  productId,
  userId,
  changeType,
  quantityChange,
  stockBefore,
  stockAfter,
  reason,
  referenceId
}: {
  tenantId: number;
  productId: number;
  userId: number | null;
  changeType: 'increase' | 'decrease' | 'adjustment' | 'sale' | 'initial';
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string | null;
  referenceId?: number | null;
}) {
  try {
    const { error } = await supabase
      .from('stock_changes')
      .insert([{
        tenant_id: tenantId,
        product_id: productId,
        user_id: userId,
        change_type: changeType,
        quantity_change: quantityChange,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reason: reason || null,
        reference_id: referenceId || null
      }]);

    if (error) {
      console.error('Error registrando cambio de stock:', error);
      // No lanzamos error para no interrumpir el flujo principal
      // pero sí lo registramos en consola
    }
  } catch (error) {
    console.error('Error en recordStockChange:', error);
  }
}

/**
 * Actualiza el stock de un producto y registra el cambio
 */
export async function updateProductStock({
  productId,
  newStock,
  tenantId,
  userId,
  changeType,
  reason,
  referenceId
}: {
  productId: number;
  newStock: number;
  tenantId: number;
  userId: number | null;
  changeType: 'increase' | 'decrease' | 'adjustment' | 'sale' | 'initial';
  reason?: string;
  referenceId?: number;
}) {
  try {
    // Obtener stock actual
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      console.error('Error obteniendo producto:', fetchError);
      return { success: false, error: fetchError };
    }

    const stockBefore = product.stock;
    const quantityChange = newStock - stockBefore;

    // Actualizar stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);

    if (updateError) {
      console.error('Error actualizando stock:', updateError);
      return { success: false, error: updateError };
    }

    // Registrar el cambio
    await recordStockChange({
      tenantId,
      productId,
      userId,
      changeType,
      quantityChange,
      stockBefore,
      stockAfter: newStock,
      reason: reason || `${changeType === 'increase' ? 'Aumento' : changeType === 'decrease' ? 'Disminución' : changeType === 'adjustment' ? 'Ajuste' : changeType === 'sale' ? 'Venta' : 'Stock inicial'} de stock`,
      referenceId
    });

    return { success: true };
  } catch (error) {
    console.error('Error en updateProductStock:', error);
    return { success: false, error };
  }
}


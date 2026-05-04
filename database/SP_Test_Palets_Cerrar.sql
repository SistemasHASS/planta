-- Stored Procedure para cerrar un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Cerrar]
    @Id INT,
    @TipoCierre VARCHAR(50),
    @UsuarioId INT,
    @Observaciones VARCHAR(MAX) = NULL,
    @MedidaCorrectiva VARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Actualizar el palet
    UPDATE Palets
    SET 
        Estado = CASE 
            WHEN @TipoCierre = 'CERRAR' THEN 'CERRADO_COMPLETO'
            WHEN @TipoCierre = 'SALDO' THEN 'CERRADO_SALDO'
            ELSE 'CERRADO_COMPLETO'
        END,
        FechaCierre = GETDATE(),
        Observaciones = @Observaciones,
        MedidaCorrectiva = @MedidaCorrectiva,
        UsuarioModificacionId = @UsuarioId,
        FechaModificacion = GETDATE()
    WHERE 
        Id = @Id;
    
    -- Devolver el palet actualizado
    SELECT 
        p.Id,
        p.Numero,
        p.NumeroPalet,
        p.Estado,
        p.CantidadCajas,
        p.PesoTotal,
        p.PorcentajeAvance,
        p.FormatoId,
        p.ProcesoId,
        p.AcopioId,
        p.FechaCreacion,
        p.FechaCierre,
        p.Observaciones,
        p.MedidaCorrectiva,
        f.Descripcion AS FormatoDescripcion,
        f.LimiteCajasPorPalet,
        a.Codigo AS AcopioCodigo,
        a.Nombre AS AcopioNombre,
        pr.Turno,
        p.NumeroViaje,
        p.PrimeraComposicionFecha
    FROM 
        Palets p
        LEFT JOIN Formatos f ON p.FormatoId = f.Id
        LEFT JOIN Acopios a ON p.AcopioId = a.Id
        LEFT JOIN Procesos pr ON p.ProcesoId = pr.Id
    WHERE 
        p.Id = @Id;
END
